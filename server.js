const express = require('express');
const cors = require('cors');

const app = express(); 
app.use(cors());
app.use(express.json());
const path = require('path'); 

app.use((req, res, next) => {
    console.log(`Incoming Request: ${req.method} ${req.url}`);
    next();
});

const studentRoutes = require('./routes/studentRoutes');
app.use('/api', studentRoutes);

app.get('/', (req, res) => res.send('Server is running!'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
