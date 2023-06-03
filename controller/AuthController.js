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
//FIXME: malformed token
const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await Auth.findOne({ username: username });

    const users = await Auth.find();

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign({
      username: user.username,
      role: user.role
    }, process.env.JWT_SECRET);
    console.log(token);
    res.set('Authorization', token);
    res.json({ message: 'Login successful' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};



module.exports = {
  register,
  login,

};