const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/goals — all goals for current user
router.get('/', authenticateToken, (req, res) => {
  try {
    const goals = db.get('goals')
      .filter({ user_id: req.user.id })
      .value()
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    res.json(goals);
  } catch (e) {
    console.error('get goals error', e);
    res.status(500).json({ error: 'Failed to fetch goals' });
  }
});

// POST /api/goals — create a goal
router.post('/', authenticateToken, (req, res) => {
  try {
    const { name, target_amount, current_amount, description, deadline, color, icon, priority, status } = req.body;
    if (!name || target_amount === undefined) {
      return res.status(400).json({ error: 'name and target_amount are required' });
    }
    const now = new Date().toISOString();
    const newGoal = {
      id:             uuidv4(),
      user_id:        req.user.id,
      name,
      target_amount:  parseFloat(target_amount),
      current_amount: current_amount !== undefined ? parseFloat(current_amount) : 0,
      description:    description || null,
      deadline:       deadline || null,
      color:          color || '#4ECDC4',
      icon:           icon || '🎯',
      priority:       priority || 'medium',
      status:         status || 'active',
      created_at:     now,
      updated_at:     now,
    };
    db.get('goals').push(newGoal).write();
    res.status(201).json(newGoal);
  } catch (e) {
    console.error('create goal error', e);
    res.status(500).json({ error: 'Failed to create goal' });
  }
});

// PUT /api/goals/:id — update a goal
router.put('/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const goal = db.get('goals').find({ id, user_id: req.user.id }).value();
    if (!goal) return res.status(404).json({ error: 'Goal not found' });

    const { name, target_amount, current_amount, description, deadline, color, icon, priority, status } = req.body;
    const updated = {
      ...goal,
      name:           name           ?? goal.name,
      target_amount:  target_amount  !== undefined ? parseFloat(target_amount)  : goal.target_amount,
      current_amount: current_amount !== undefined ? parseFloat(current_amount) : goal.current_amount,
      description:    description    !== undefined ? description    : goal.description,
      deadline:       deadline       !== undefined ? deadline       : goal.deadline,
      color:          color          ?? goal.color,
      icon:           icon           ?? goal.icon,
      priority:       priority       ?? goal.priority,
      status:         status         ?? goal.status,
      updated_at:     new Date().toISOString(),
    };
    db.get('goals').find({ id, user_id: req.user.id }).assign(updated).write();
    res.json(updated);
  } catch (e) {
    console.error('update goal error', e);
    res.status(500).json({ error: 'Failed to update goal' });
  }
});

// DELETE /api/goals/:id
router.delete('/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const goal = db.get('goals').find({ id, user_id: req.user.id }).value();
    if (!goal) return res.status(404).json({ error: 'Goal not found' });
    db.get('goals').remove({ id, user_id: req.user.id }).write();
    res.json({ message: 'Deleted' });
  } catch (e) {
    console.error('delete goal error', e);
    res.status(500).json({ error: 'Failed to delete goal' });
  }
});

module.exports = router;
