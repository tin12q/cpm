const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const Auth = require('../models/auth.model');

//TODO: fix this
const register = async (req, res) => {
  try {
    const { username, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new Auth({ username, password: hashedPassword });
    await user.save();
    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
const login = async (req, res) => {
  try {
    const { username, password } = req.body;
    console.log(username);
    console.log(password);
    const user = await Auth.findOne({ username: username });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({
      id: user.user,
      role: user.role
    }, process.env.JWT_SECRET);

    res.set('Authorization', "Bearer " + token);
    res.json({ message: 'Login successful', role: user.role });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};



module.exports = {
  register,
  login,

};