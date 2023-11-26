import express from "express";
import * as userController from "../controllers/user.controller";
import { isAdmin, isAuthenticated } from "../middleware/auth";


const userRouter = express.Router();


userRouter.post("/register", userController.registerUser);

//activate user
userRouter.post("/activate-user", userController.activateUser);

//login user
userRouter.post("/login", userController.loginUser);

//logout user
userRouter.get("/logout", isAuthenticated, userController.logoutUser);

//update access token
userRouter.get("/refresh-token", userController.updateAccessToken);

//get user info
userRouter.get("/me", userController.updateAccessToken, isAuthenticated, userController.getUserInfo);

//social auth
userRouter.post("/social-auth", userController.socialAuth);

//updat user info
userRouter.put("/update-user", userController.updateAccessToken, isAuthenticated, userController.updateUser);

//update password
userRouter.put("/update-password", userController.updateAccessToken, isAuthenticated, userController.updatePassword);

//update user avatar
userRouter.put("/update-avatar", userController.updateAccessToken, isAuthenticated, userController.updateUserAvatar);

// get all users -- admin route
userRouter.get("/get-users", userController.updateAccessToken, isAuthenticated, isAdmin, userController.getAllUsers);

// update user role -- admin route
userRouter.put("/update-user-role", isAuthenticated, isAdmin, userController.updateUserRole);

// delete user -- admin route
userRouter.delete("/delete-user/:id", isAuthenticated, isAdmin, userController.deleteUser);

export default userRouter;