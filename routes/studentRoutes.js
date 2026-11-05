const express = require('express');

const router = express.Router();
router.get("/api/student/:enrollment_number/sem1-courses", async (req, res) => {
    const enrollmentNumber = req.params.enrollment_number; // ✅ Extract enrollment number
    console.log(`Incoming Request: GET /api/student/${enrollmentNumber}/sem1-courses`);

    if (!enrollmentNumber) {
        return res.status(400).json({ error: "Enrollment number is missing!" });
    }

    // ✅ Fetch student details from the database
    const student = await student.findOne({ enrollment_number: enrollmentNumber });

    if (!student) {
        return res.status(404).json({ error: "Student not found!" });
    }

    console.log(`Returning Semester 1 Courses for ${student.name}:`, student.semester1_courses);
    res.json(student.semester1_courses);
});

router.get('/test', (req, res) => {
    res.json({ message: "API is working!" });
});
const studentController = require('../controllers/studentController');
//console.log("selectSem3Courses Function:", studentController.selectSem3Courses);
//router.post('/login', studentController.loginStudent);
router.post('/register', studentController.signupUser);
console.log("Login Function:", studentController.loginUser);
router.post('/login', studentController.loginUser);
router.get('/student/:enrollment_number', studentController.getStudent);
router.put('/student/:enrollment_number/updateCourses', studentController.updateCourses);
router.get('/student/:enrollment_number/search-courses', studentController.searchCourses);
router.get('/student/:enrollment_number/sem3-recommendations', studentController.getSem3Recommendations);
router.put('/student/:enrollment_number/select-sem3-courses', studentController.selectSem3Courses);
router.post('/student/:enrollment_number/finalize', studentController.finalizeCourses);
router.get('/student/:enrollment_number/finallist', studentController.getFinalList);
router.get('/student/:enrollment_number/download', studentController.downloadFinalCourses);
router.get('/student/:enrollment_number/sem1-courses', studentController.getSem1Courses);
// Removed invalid and unused code block that caused syntax error.

module.exports = router;
