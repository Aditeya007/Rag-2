// admin-backend/routes/users.js

const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const userController = require('../controllers/userController');
const {
  validateCreateUser,
  validateUpdateUser
} = require('../middleware/validate');
const { userLimiter } = require('../middleware/rateLimiter');

router.use(auth, userLimiter);

/**
 * @route   GET /api/users
 * @desc    List all users
 * @access  Protected (admin only)
 */
router.get('/', userController.getAllUsers);

/**
 * @route   POST /api/users
 * @desc    Create a new user
 * @access  Protected (admin only)
 */
router.post('/', validateCreateUser, userController.createUser);

/**
 * @route   GET /api/users/:id/resources
 * @desc    Retrieve provisioned resource metadata for a user
 * @access  Protected (admin only)
 */
router.get('/:id/resources', userController.getUserResources);

/**
 * @route   GET /api/users/:id
 * @desc    Fetch a user by ID
 * @access  Protected (admin only)
 */
router.get('/:id', userController.getUserById);

/**
 * @route   PUT /api/users/:id
 * @desc    Update a user
 * @access  Protected (admin only)
 */
router.put('/:id', validateUpdateUser, userController.updateUser);

/**
 * @route   DELETE /api/users/:id
 * @desc    Delete a user
 * @access  Protected (admin only)
 */
router.delete('/:id', userController.deleteUser);

module.exports = router;
