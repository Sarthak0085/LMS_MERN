import express from "express";
import { isAdmin, isAuthenticated } from "../middleware/auth";
import * as notificationController from "../controllers/notification.controller";

const notificationRouter = express.Router();

// get all notifications by admin
notificationRouter.get("/get-notifications", isAuthenticated, isAdmin, notificationController.getAllNotifications);

// update notification by admin
notificationRouter.put("/update-notification/:id", isAuthenticated, isAdmin, notificationController.updateNotificationStatus);


export default notificationRouter;