const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// Connect to MongoDB (free database)
mongoose.connect('mongodb+srv://tradingbot:tradingbot123@cluster0.mongodb.net/tradingbot?retryWrites=true&w=majority')
  .then(() => console.log('Database connected'))
  .catch(err => console.log('Database error:', err));

// User Schema
const UserSchema = new mongoose.Schema({
  telegramId: Number,
  name: String,
  plan: { type: String, default: 'free' },
  signalsUsed: { type: Number, default: 0 },
  signalsLimit: { type: Number, default: 3 },
  totalSignals: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

const SignalSchema = new mongoose.Schema({
  userId: Number,
  pair: String,
  direction: String,
  accuracy: Number,
  signalType: String,
  result: { type: String, default: 'PENDING' },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);
const Signal = mongoose.model('Signal', SignalSchema);

// Routes

// Get or create user
app.get('/api/user/:telegramId', async (req, res) => {
  let user = await User.findOne({ telegramId: req.params.telegramId });
  if (!user) {
    user = await User.create({ 
      telegramId: req.params.telegramId,
      name: 'Trader ' + req.params.telegramId.toString().slice(-4)
    });
  }
  res.json(user);
});

// Generate signal (simple random for now)
app.post('/api/signal', async (req, res) => {
  const { telegramId, pair } = req.body;
  
  const user = await User.findOne({ telegramId });
  if (user.signalsUsed >= user.signalsLimit) {
    return res.status(403).json({ error: 'Limit reached' });
  }
  
  // Simple signal generation
  const direction = Math.random() > 0.5 ? 'BUY' : 'SELL';
  const accuracy = Math.floor(Math.random() * (90 - 70) + 70);
  
  const signalTypes = { free: 'Silver', basic: 'Gold', premium: 'Premium', platinum: 'Platinum' };
  
  await Signal.create({
    userId: telegramId,
    pair,
    direction,
    accuracy,
    signalType: signalTypes[user.plan] || 'Silver'
  });
  
  user.signalsUsed += 1;
  user.totalSignals += 1;
  await user.save();
  
  res.json({
    pair,
    direction,
    accuracy,
    signalType: signalTypes[user.plan] || 'Silver',
    price: Math.random() * 100 + 1
  });
});

// Get history
app.get('/api/history/:telegramId', async (req, res) => {
  const signals = await Signal.find({ userId: req.params.telegramId })
    .sort({ createdAt: -1 })
    .limit(50);
  res.json(signals);
});

// Get stats
app.get('/api/stats/:telegramId', async (req, res) => {
  const user = await User.findOne({ telegramId: req.params.telegramId });
  const signals = await Signal.find({ userId: req.params.telegramId, result: { $ne: 'PENDING' } });
  
  const wins = signals.filter(s => s.result === 'WIN').length;
  
  res.json({
    totalSignals: user.totalSignals,
    wins,
    losses: signals.length - wins,
    winRate: signals.length > 0 ? Math.round((wins / signals.length) * 100) : 0,
    byType: {
      Silver: await Signal.countDocuments({ userId: req.params.telegramId, signalType: 'Silver' }),
      Gold: await Signal.countDocuments({ userId: req.params.telegramId, signalType: 'Gold' }),
      Premium: await Signal.countDocuments({ userId: req.params.telegramId, signalType: 'Premium' }),
      Platinum: await Signal.countDocuments({ userId: req.params.telegramId, signalType: 'Platinum' })
    }
  });
});

// Upgrade plan
app.post('/api/upgrade', async (req, res) => {
  const { telegramId, plan } = req.body;
  const limits = { free: 3, basic: 10, premium: 999999, platinum: 999999 };
  
  await User.findOneAndUpdate(
    { telegramId },
    { plan, signalsLimit: limits[plan] }
  );
  
  res.json({ success: true });
});

// Admin stats
app.get('/api/admin/stats', async (req, res) => {
  res.json({
    totalUsers: await User.countDocuments(),
    totalSignals: await Signal.countDocuments(),
    todaySignals: await Signal.countDocuments({ createdAt: { $gte: new Date(Date.now() - 24*60*60*1000) } }),
    revenue: 0
  });
});

// Admin users
app.get('/api/admin/users', async (req, res) => {
  const users = await User.find().sort({ createdAt: -1 }).limit(100);
  res.json(users);
});

app.listen(3000, () => console.log('Server running'));
