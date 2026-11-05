const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const bcrypt = require("bcrypt");
const studentsPath = path.join(__dirname, '../data/students.json');
const coursesPath = path.join(__dirname, '../data/courses.json');
const adminsPath = path.join(__dirname, '../data/admin.json');
const saltRounds = 10;

// Helper function to safely read JSON data
function readJSON(file) {
    try {
        const data = fs.readFileSync(file, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error(`❌ Error reading ${file}:`, err.message);
        return [];
    }
}

// Helper function to safely write JSON data
function writeJSON(file, data) {
    try {
        const jsonString = JSON.stringify(data, null, 2);
        fs.writeFileSync(file, jsonString, 'utf8');
        console.log(`✅ Successfully updated ${file}`);
        return { success: true };
    } catch (err) {
        console.error(`❌ Error writing ${file}:`, err.message);
        return { success: false, error: err.message };
    }
}

// Login or Register Student
const signupUser = (req, res) => {
  const { role, pin } = req.body;

  if (!role || !pin || pin.length !== 4) {
    return res.status(400).json({ error: "Role and 4-digit PIN are required." });
  }

  const hashedPin = bcrypt.hashSync(pin, saltRounds);
  if (role === "student") {
    const { name, enrollment_number, Batch, specialization, cgpa } = req.body;

    // Better validation - check for empty strings and undefined
    if (!name || !name.trim() || !enrollment_number || !enrollment_number.trim() || !Batch || !Batch.trim() || !specialization || !specialization.trim() || cgpa === undefined || cgpa === '') {
      console.error('❌ Student signup validation failed. Received:', {
        name: name || 'missing',
        enrollment_number: enrollment_number || 'missing',
        Batch: Batch || 'missing',
        specialization: specialization || 'missing',
        cgpa: cgpa || 'missing',
        role: role
      });
      return res.status(400).json({ error: "Missing required student fields: name, enrollment_number, Batch, specialization, and cgpa are all required." });
    }

    const students = readJSON(studentsPath);
    const exists = students.find(s => s.enrollment_number === enrollment_number);

    if (exists) {
      return res.status(400).json({ error: "Student already exists." });
    }

    const studentData = {
      enrollment_number,
      name,
      Batch,
      specialization,
      cgpa: parseFloat(cgpa), // Convert to number
      pinHash: hashedPin,
      totalCredits: 0,
      sem1_done: [],
      sem2_done: [],
      selected_courses: [],
      open_electives: [],
      final_courses: [],
      finalized: false
    };

    students.push(studentData);
    writeJSON(studentsPath, students);
    const { pinHash, ...studentSafe } = studentData;
    console.log('✅ Student signup successful:', studentSafe.name);
    return res.json({ message: "Student signup successful", student: studentSafe });

  } else if (role === "admin") {
    const { name, department, designation, email, employee_id } = req.body;

    // Better validation for admin fields
    if (!name || !name.trim() || !department || !department.trim() || !designation || !designation.trim() || !email || !email.trim() || !employee_id || !employee_id.trim()) {
      console.error('❌ Admin signup validation failed. Received:', {
        name: name || 'missing',
        department: department || 'missing',
        designation: designation || 'missing',
        email: email || 'missing',
        employee_id: employee_id || 'missing',
        role: role
      });
      return res.status(400).json({ error: "Missing required admin fields: name, department, designation, email, and employee_id are all required." });
    }

    const admins = readJSON(adminsPath);
    const exists = admins.find(a => a.email === email || a.employee_id === employee_id);

    if (exists) {
      return res.status(400).json({ error: "Admin already exists." });
    }

    const adminData = {
      name,
      department,
      designation,
      email,
      employee_id,
      pinHash: hashedPin
    };

    admins.push(adminData);
    writeJSON(adminsPath, admins);
    const { pinHash, ...adminSafe } = adminData;
    console.log('✅ Admin signup successful:', adminSafe.name);
    return res.json({ message: "Admin signup successful", admin: adminSafe });

  } else {
    console.error('❌ Invalid role:', role);
    return res.status(400).json({ error: "Invalid role specified. Role must be 'student' or 'admin'." });
  }
};
const loginUser = (req, res) => {
  const { role, pin } = req.body;

  if (!role || !pin || pin.length !== 4) {
    console.log("missing role or pin");
    return res.status(400).json({ error: "Role and 4-digit PIN are required." });
  }

  if (role === "student") {
    const { enrollment_number } = req.body;
     console.log("Login attempt:", req.body);
    console.log("Role:", role);
    console.log("PIN:", pin);
    console.log("Enrollment Number:", enrollment_number);
    if (!enrollment_number) {
      return res.status(400).json({ error: "Enrollment number required." });
    }
    const students = readJSON(studentsPath);
    const student = students.find(s => s.enrollment_number === enrollment_number);
    if (!student) {
      return res.status(404).json({ error: "Student not found." });
    }
    console.log("Student found:", student);
    console.log("Comparing PIN:", pin, "with hash:", student.pinHash);
    if (!bcrypt.compareSync(pin, student.pinHash)) {
      return res.status(401).json({ error: "Invalid PIN." });
    }
    const { pinHash, ...studentSafe } = student;
    studentSafe.role = "student"; // <-- Add this line
    
    return res.json({ message: "Student login successful", user: studentSafe });

  } else if (role === "admin") {
    const { email, employee_id } = req.body;
    if (!email && !employee_id) {
      return res.status(400).json({ error: "Email or Employee ID required." });
    }
    const admins = readJSON(adminsPath);
    const admin = admins.find(a =>
      (email && a.email === email) || (employee_id && a.employee_id === employee_id)
    );
    if (!admin) {
      return res.status(404).json({ error: "Admin not found." });
    }
    if (!bcrypt.compareSync(pin, admin.pinHash)) {
      return res.status(401).json({ error: "Invalid PIN." });
    }
    const { pinHash, ...adminSafe } = admin;
    adminSafe.role = "admin"; // <-- Add this line
    return res.json({ message: "Admin login successful", user: adminSafe });

  } else {
    return res.status(400).json({ error: "Invalid role specified." });
  }
};

 // Load semester 1 courses
const getStudent = (req, res) => {
    try {
        console.log(`📡 Fetching student info for enrollment_number: ${req.params.enrollment_number}`);

        const students = readJSON(studentsPath);
        const studentIndex = students.findIndex(s => s.enrollment_number === req.params.enrollment_number);
        if (studentIndex === -1) {
            console.error(`❌ Student not found: ${req.params.enrollment_number}`);
            return res.status(404).json({ error: "Student not found" });
        }

        const student = students[studentIndex];

        // ✅ If `sem1_done` already exists, just return the student info
        if (student.sem1_done && student.sem1_done.length > 0) {
            console.log(`⏩ Semester 1 courses already exist for ${student.enrollment_number}, skipping update.`);
        }

        console.log("✅ Student Found:", student);
        res.json({ studentData: student });

    } catch (error) {
        console.error("❌ Error processing student data:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
// Get Semester 1 Courses

const getSem1Courses = (req, res) => {
    try {
        const students = readJSON(studentsPath); 
        const courses = readJSON(coursesPath); 

        const enrollmentNumber = req.params.enrollment_number;
        console.log(`📡 Incoming Request: GET /api/student/${enrollmentNumber}/sem1-courses`);

        // ✅ Validate student existence
        const studentIndex = students.findIndex(s => s.enrollment_number === enrollmentNumber);
        if (studentIndex === -1) {
            console.error(`❌ Student not found: ${enrollmentNumber}`);
            return res.status(404).json({ error: "Student not found" });
        }

        const student = students[studentIndex];

        // ✅ Extract batch key correctly
        const batchKey = student.Batch.trim().toLowerCase();
        console.log(`🔍 Batch Key: ${batchKey}`);

        // ✅ Determine Semester 1 courses based on batch
        let sem1_done = [];
        if (["b1", "b2", "b3", "b4"].includes(batchKey)) {
            sem1_done = courses.sem1_b1_b4?.map(formatCourse) || [];
        } else if (batchKey === "b5") {
            sem1_done = courses.sem1_b5?.map(formatCourse) || [];
        } else if (["b6", "b7"].includes(batchKey)) {
            sem1_done = courses.sem1_b6_b7?.map(formatCourse) || [];
        } else if (["b8", "b9", "b10", "b11"].includes(batchKey)) {
            sem1_done = courses.sem1_b8_b11?.map(formatCourse) || [];
        }

        // ✅ Auto-fill `sem1_done` if empty and persist changes
        if (!student.sem1_done || student.sem1_done.length === 0) {
            student.sem1_done = sem1_done;
            fs.writeFileSync(studentsPath, JSON.stringify(students, null, 2)); // 🔥 Save permanently
            console.log(`✅ Auto-filled Semester 1 courses for ${student.enrollment_number}:`, sem1_done);
        } else {
            console.log(`⏩ Semester 1 courses already exist for ${student.enrollment_number}, skipping update.`);
        }

         // ✅ Calculate total credits
        const sem1_donecredits = sem1_done.reduce((sum, course) => sum + (course.credits || 0), 0);
console.log(`returning total credits of semester 1 courses for ${student.enrollment_number}:`,sem1_donecredits);

        // ✅ Respond with totalCredits and courses
        res.json({
            totalCredits: sem1_donecredits,
            courses: sem1_done
        });

    } catch (error) {
        console.error("❌ Error processing Semester 1 courses:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
// ✅ Helper function to format course data
const formatCourse = (course) => ({
    course_code: course.course_code,
    course_name: course.course_name,
    labs_per_week: course.labs_per_week,
    classes_per_week: course.classes_per_week,
    credits: course.credits
});
  // 🔥 Specialization-Based Open Electives Mapping
    const openElectivesMapping = {
        "Computer Science Engineering": "cse_core",
        "Artificial Intelligence and Machine Learning": "aiml",
        "Cyber Security": "cyber_security",
        "Cloud Computing": "cloud_computing",
        "Big Data": "big_data",
        "DevOps": "devops",
        "Data Analytics": "data_analytics",
        "IoT": "iot",
        "Robotics": "robotics",
        "Bio Technology":"biotechnology"
    };
const getOpenElectives = (student, courses) => {
    if (!student) return [];
    // ✅ Assign electives based on specialization
    const specializationKey = openElectivesMapping[student.specialization];
    const open_electives = specializationKey ? courses.open_electives[specializationKey] || [] : [];

    console.log(`Mapped Open Electives for ${student.specialization}:`, open_electives);
    return open_electives;
}



// 4. Search Courses
const searchCourses = (req, res) => {
  console.log("reach");
  const students = readJSON(studentsPath);
  const enrollmentNumber = req.params.enrollment_number;
  console.log(`Incoming Request: GET /api/student/${enrollmentNumber}/search-courses`);
  const keyword = req.query.keyword?.toLowerCase() || ""; 
  const courses = readJSON(coursesPath);

 
    const sem2_offered = Array.isArray(courses.sem2_offered) ? courses.sem2_offered: [];
     const generalCategory = sem2_offered.find(cat => cat.category === "general");
if (generalCategory) {
  generalCategory.courses.forEach(course => {
    console.log(course.course_name);
  });
}

// Flatten sem2_offered and open_electives, keeping category info
const sem2_courses_flat = sem2_offered.flatMap(cat =>
  (cat.courses || []).map(course => ({ ...course, category: cat.category }))
);


// sem3_core_courses is already flat

let allCourses = [
  ...sem2_courses_flat
];
    // ✅ Validate student existence
    const student = students.find(s => s.enrollment_number === enrollmentNumber);
    if (!student) {
        console.error(`❌ Student not found: ${enrollmentNumber}`);
        return res.status(404).json({ error: "Student not found" });
    }
     // ✅ Extract keyword from query params
    console.log(`Incoming Request: GET /api/student/${enrollmentNumber}/search-courses?keyword=${keyword}`);
    // ✅ Apply keyword filtering
    if (keyword) {
        const clean = str => str ? str.toLowerCase().trim().replace(/\s+/g, ' ') : '';

const searchTerm = clean(keyword);

allCourses = allCourses.filter(course =>
  (course.course_name && clean(course.course_name).includes(searchTerm)) ||
  (course.course_code && clean(course.course_code).includes(searchTerm))
);
    }

    console.log(`Returning Search Results for ${student.enrollment_number}:`, allCourses);
    res.json({
    courses: allCourses
}); 
 };
// 3. Update Semester 2 or electives
function updateCourses(req, res) {
    try {
        const { enrollment_number } = req.params;
        const { course_code } = req.body;
        const students = readJSON(studentsPath);
        const student = students.find(s => s.enrollment_number === enrollment_number);
        if (!student) return res.status(404).json({ error: 'Student not found' });

        student.sem2_done = student.sem2_done || [];
        let addedCourse = null;
        // Find the course object (assuming you have a courses list)
        const allCourses = readJSON(coursesPath).sem2_offered.flatMap(cat => cat.courses);
        console.log("Received course_code:", course_code);
console.log("Available course codes:", allCourses.map(c => c.course_code));
        if (course_code && !student.sem2_done.some(c => c.course_code === course_code)) {
            addedCourse = allCourses.find(c => c.course_code === course_code);
            
            if (addedCourse) {
                student.sem2_done.push(addedCourse);
            }
        }
                 // ✅ Calculate total credits
        const sem2_donecredits = student.sem2_done.reduce((sum, course) => sum + (course.credits || 0), 0);
console.log(`returning total credits of semester 2 courses for ${student.enrollment_number}:`,sem2_donecredits);
        writeJSON(studentsPath, students);
        res.json({
            success: true,
            message: 'Course added successfully',
            course: addedCourse,
            credits:sem2_donecredits,
            student
        });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
}
// 5. Recommend Semester 3 courses
const getSem3Recommendations = (req, res) => {
    try {
        const students = readJSON(studentsPath);
        const courses = readJSON(coursesPath);
        const student = students.find(s => s.enrollment_number  === req.params.enrollment_number);

        if (!student) {
            console.error(`❌ Student not found: ${req.params.enrollment_number}`);
            return res.status(404).json({ error: 'Student not found' });
        }

        

        // Ensure Batch and specialization keys are valid
const batchKey = student.Batch ? student.Batch.toLowerCase() : null;
const specializationKey = student.specialization ? student.specialization.toLowerCase() : null;

// Retrieve specialization-based electives safely
const openElectives = specializationKey
    ? courses.open_electives.filter(item => item.category === specializationKey)
    : [];
const openElectivesFlat = openElectives.flatMap(item =>
    (item.courses || []).map(course => ({ ...course, category: item.category }))
);

// Extract completed courses from Semester 1 & 2
const completedCourses = new Set([
    ...(Array.isArray(student.sem1_done) ? student.sem1_done : []).map(c => c.course_code),
    ...(Array.isArray(student.sem2_done) ? student.sem2_done : []).map(c => c.course_code)
]);
console.log("specializationKey:", specializationKey);
console.log("openElectives categories:", courses.open_electives.map(e => e.category));
// Merge recommended courses from batch-specific, core, and open electives, keeping category info
const sem3Recommended = (courses.sem3_recommended || [])
    .filter(c => c.category && c.category.includes(batchKey))
    .flatMap(item => (item.courses || []).map(course => ({ ...course, category: item.category })));

const sem3Core = (Array.isArray(courses.sem3_core_courses) ? courses.sem3_core_courses : [])
    .map(course => ({ ...course, category: 'sem3_core' }));

let recommendedCourses = [
    ...sem3Recommended,
    ...sem3Core,
    ...openElectivesFlat
].filter(course => !completedCourses.has(course.course_code));

        console.log("🔥 All Possible Recommended Courses:", recommendedCourses); 

        
        // ✅ **Flatten JSON response with recommended & elective courses**
        res.json({
            recommended_courses: recommendedCourses
        });

    } catch (error) {
        console.error("❌ Error processing Semester 3 recommendations:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
// Select Semester 3 Courses
    const selectSem3Courses = (req, res) => {
    console.log(`Selecting Semester 3 courses for enrollment_number: ${req.params.enrollment_number}`);
    const { enrollment_number } = req.params;
    const { selected_courses = [], open_electives = [] } = req.body;

    console.log("Incoming Request Body:", req.body);

    if (!Array.isArray(selected_courses) || !Array.isArray(open_electives)) {
        return res.status(400).json({ error: "Invalid course selections format" });
    }

    const students = readJSON(studentsPath);
    const student = students.find(s => s.enrollment_number === enrollment_number);

    if (!student) {
        return res.status(404).json({ error: "Student not found" });
    }

    const courses = readJSON(coursesPath);

    // Prepare all possible recommended and elective courses
    const batchKey = student.Batch?.toLowerCase();
    const specializationKey = student.specialization?.toLowerCase();

    // Get recommended core courses
    const sem3Recommended = (courses.sem3_recommended || [])
        .filter(c => c.category && c.category.includes(batchKey))
        .flatMap(item => (item.courses || []));

    const sem3Core = Array.isArray(courses.sem3_core_courses) ? courses.sem3_core_courses : [];

    // Get open electives for the student's specialization
    const openElectives = (courses.open_electives || []).filter(e => e.category === specializationKey);
    const openElectivesFlat = openElectives.flatMap(e => e.courses || []);

    // Combine all possible courses for validation
    const allValidCourses = [
        
        ...sem3Recommended,
        ...sem3Core,
        ...openElectivesFlat
    ];

    // Validate and collect selected core courses
    let totalCredits = 0;
    const selectedSem3Courses = [];
    for (const codeObj of selected_courses) {
        const course = allValidCourses.find(c => c.course_code === codeObj.course_code);
        if (course && totalCredits + course.credits <= 45) {
            selectedSem3Courses.push(course);
            totalCredits += course.credits;
        }
    }

    // Validate and collect selected open electives
    const selectedOpenElectives = [];
    for (const codeObj of open_electives) {
        const course = openElectivesFlat.find(c => c.course_code === codeObj.course_code);
        if (course && totalCredits + course.credits <= 45) {
            selectedOpenElectives.push(course);
            totalCredits += course.credits;
        }
    }

    // Save selections to student object
    student.selected_sem3_courses = selectedSem3Courses;
    student.selected_open_electives = selectedOpenElectives;
    student.selected_credits = selectedSem3Courses.reduce((sum, c) => sum + c.credits, 0);
    student.open_electives_selected_credits = selectedOpenElectives.reduce((sum, c) => sum + c.credits, 0);

    writeJSON(studentsPath, students);
console.log(`Selected Semester 3 courses for ${enrollment_number}:`, {
        selectedSem3Courses,
        selectedOpenElectives
    });
    res.json({
        success: true,
        message: "Semester 3 courses selected successfully!",
        total_credits: student.selected_credits + student.open_electives_selected_credits,
        sem3_credits: student.selected_credits,
        open_electives_credits: student.open_electives_selected_credits,
        selected_sem3_courses: selectedSem3Courses,
        selected_open_electives: selectedOpenElectives
    });
};
// 6. Finalize Selected Courses
   const finalizeCourses = (req, res) => {
    console.log('🔒 Finalize request for:', req.params.enrollment_number);
    
    const { enrollment_number } = req.params;
    const students = readJSON(studentsPath);
    const student = students.find(s => s.enrollment_number === enrollment_number);

    if (!student) {
        console.error('❌ Student not found:', enrollment_number);
        return res.status(404).json({ error: 'Student not found' });
    }

    console.log('📊 Student data before finalization:', {
        enrollment_number: student.enrollment_number,
        sem1_done: student.sem1_done?.length || 0,
        sem2_done: student.sem2_done?.length || 0,
        selected_sem3_courses: student.selected_sem3_courses?.length || 0,
        selected_open_electives: student.selected_open_electives?.length || 0
    });

    // Add category to each course for frontend segregation
    const sem1Courses = (student.sem1_done || []).map(c => ({ ...c, category: 'sem1_done' }));
    const sem2Courses = (student.sem2_done || []).map(c => ({ ...c, category: 'sem2_done' }));
    const sem3Courses = (student.selected_sem3_courses || []).map(c => ({ ...c, category: 'sem3_core_courses' }));
    const openElectives = (student.selected_open_electives || []).map(c => ({ ...c, category: 'open_elective' }));

    // Combine all finalized courses
    const finalCourses = [
        ...sem1Courses,
        ...sem2Courses,
        ...sem3Courses,
        ...openElectives
    ];

    if (!finalCourses.length) {
        console.warn('⚠️ No courses to finalize');
        return res.status(400).json({ error: "No courses selected to finalize." });
    }

    const sem1_donecredits = sem1Courses.reduce((sum, c) => sum + (c.credits || 0), 0);
    const sem2_donecredits = sem2Courses.reduce((sum, c) => sum + (c.credits || 0), 0);
    const sem3_credits = sem3Courses.reduce((sum, c) => sum + (c.credits || 0), 0);
    const elective_credits = openElectives.reduce((sum, c) => sum + (c.credits || 0), 0);
    const total_credits = sem1_donecredits + sem2_donecredits + sem3_credits + elective_credits;

    // Mark finalized and store details
    student.final_courses = finalCourses;
    student.finalized = true;
    student.final_credits = total_credits;
    student.finalized_date = new Date().toISOString();

    // Save to file - check for errors
    const writeResult = writeJSON(studentsPath, students);
    
    if (!writeResult.success) {
        console.error('❌ Failed to save finalization:', writeResult.error);
        return res.status(500).json({ 
            error: 'Failed to save finalization: ' + writeResult.error,
            success: false
        });
    }
    
    console.log(`✅ Finalized courses for ${enrollment_number}: ${finalCourses.length} courses, ${total_credits} credits`);
    console.log('📋 Breakdown - Sem1: ' + sem1_donecredits + ', Sem2: ' + sem2_donecredits + ', Sem3: ' + sem3_credits + ', Electives: ' + elective_credits);
    
    res.json({
        success: true,
        message: "Final list saved successfully",
        total_credits: student.final_credits,
        sem3_credits: sem3_credits,
        final_courses: finalCourses
    });
};
    // 7. Get finalized list
   const getFinalList = (req, res) => {
    const students = readJSON(studentsPath);
    const student = students.find(s => s.enrollment_number === req.params.enrollment_number);
    if (!student || !student.finalized || !student.final_courses.length) {
        return res.status(400).json({ error: "Final course list not submitted yet." });
    }

    // Calculate credits from final_courses by category
    const sem1_donecredits = student.final_courses
        .filter(c => c.category === 'sem1_done')
        .reduce((sum, c) => sum + (c.credits || 0), 0);
    const sem2_donecredits = student.final_courses
        .filter(c => c.category === 'sem2_done')
        .reduce((sum, c) => sum + (c.credits || 0), 0);
    const sem3_credits = student.final_courses
        .filter(c => c.category === 'sem3_core_courses')
        .reduce((sum, c) => sum + (c.credits || 0), 0);
    const open_electives_credits = student.final_courses
        .filter(c => c.category === 'open_elective')
        .reduce((sum, c) => sum + (c.credits || 0), 0);

    const total_credits = sem1_donecredits + sem2_donecredits + sem3_credits + open_electives_credits;

    res.json({
        success: true,
        message: "Final list fetched successfully",
        total_credits,
        sem1_donecredits,
        sem2_donecredits,
        sem3_credits,
        open_electives_credits,
        final_courses: student.final_courses
    });
}
    // 8. Download Finalized Courses as PDF

const downloadFinalCourses = (req, res) => {
    const students = readJSON(studentsPath);
    const student = students.find(s => s.enrollment_number === req.params.enrollment_number);
    if (!student || !student.finalized || !student.final_courses) {
        return res.status(404).json({ error: "Final course list not found." });
    }

    const doc = new PDFDocument({ margin: 40, size: 'A4' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${student.enrollment_number}_final_courses.pdf"`);

    doc.pipe(res);

    // --- HEADER: Logo and University Name ---
    const logoPath = require('path').join(__dirname, 'C:/Users/Jahnavi Krishnan/course-recommendation-backend/data/public/amity logo.jpeg'); // Adjust path as needed
    try {
        doc.image(logoPath, doc.page.width / 2 - 40, 30, { width: 80 }); // Centered
    } catch (e) {
        // If logo not found, skip
    }
    doc.moveDown(2.5);
    doc.font('Times-Bold')
       .fontSize(20)
       .fillColor('#003366')
       .text('Amity University, Bengaluru', { align: 'center' });
    doc.moveDown(1);

    // --- STUDENT DETAILS ---
    doc.font('Times-Roman').fontSize(12).fillColor('#000');
    doc.text(`Name: ${student.name || ''}`);
    doc.text(`Enrollment Number: ${student.enrollment_number}`);
    doc.text(`Batch: ${student.Batch || ''}`);
    doc.text(`Specialization: ${student.specialization || ''}`);
    doc.moveDown(1);

    // --- TABLE DRAWING FUNCTION ---
    function drawTable(title, courses) {
        if (!courses.length) return;
        doc.moveDown(0.5);
        doc.font('Times-Bold').fontSize(13).fillColor('#003366').text(title);
        doc.moveDown(0.2);

        // Table column positions
        const startX = 60, startY = doc.y, rowH = 22;
        const col1 = startX, col2 = startX + 110, col3 = startX + 350, col4 = startX + 430;
        const tableW = 400;

        // Header background
        doc.rect(col1, startY, tableW, rowH).fillAndStroke('#e6f0fa', '#003366');
        doc.fillColor('#003366').font('Times-Bold').fontSize(12);
        doc.text('Course Code', col1 + 5, startY + 6, { width: 100 });
        doc.text('Course Name', col2 + 5, startY + 6, { width: 230 });
        doc.text('Credits', col3 + 5, startY + 6, { width: 50 });
        doc.fillColor('#000');

        // Draw header border
        doc.rect(col1, startY, tableW, rowH).stroke();

        // Table rows
        let y = startY + rowH;
        doc.font('Times-Roman').fontSize(11);
        courses.forEach(course => {
            // Row background
            doc.rect(col1, y, tableW, rowH).fillAndStroke('#fff', '#003366');
            doc.fillColor('#000');
            doc.text(course.course_code, col1 + 5, y + 6, { width: 100 });
            doc.text(course.course_name, col2 + 5, y + 6, { width: 230 });
            doc.text(String(course.credits), col3 + 5, y + 6, { width: 50 });
            // Row border
            doc.rect(col1, y, tableW, rowH).stroke();
            y += rowH;
        });

        // Draw vertical lines for columns
        doc.moveTo(col2, startY).lineTo(col2, y).stroke('#003366');
        doc.moveTo(col3, startY).lineTo(col3, y).stroke('#003366');
        doc.moveTo(col4, startY).lineTo(col4, y).stroke('#003366');

        doc.y = y + 5;
    }

    // --- GROUP COURSES ---
    const sem1 = student.final_courses.filter(c => c.category === 'sem1_done');
    const sem2 = student.final_courses.filter(c => c.category === 'sem2_done');
    const sem3 = student.final_courses.filter(c => c.category === 'sem3_core_courses');
    const electives = student.final_courses.filter(c => c.category === 'open_elective');

    drawTable('Semester 1 Courses', sem1);
    drawTable('Semester 2 Courses', sem2);
    drawTable('Semester 3 Core Courses', sem3);
    drawTable('Open Electives', electives);

    // --- TOTAL CREDITS ---
    doc.moveDown(1);
    doc.font('Times-Bold').fontSize(13).fillColor('#003366')
       .text(`Total Credits: ${student.final_credits || 0}`, { align: 'right' });

    doc.end();
};

    
    module.exports = {
    selectSem3Courses,
    getStudent,
    getSem1Courses,
    updateCourses,
    searchCourses,
    getSem3Recommendations,
    finalizeCourses,
    getFinalList,
    downloadFinalCourses,
    getOpenElectives ,
    signupUser,
    loginUser
};