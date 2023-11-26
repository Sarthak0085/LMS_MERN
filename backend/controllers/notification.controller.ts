import { NextFunction, Request, Response } from "express";
import { CatchAsyncError } from "../middleware/catchAsyncErrors";
import ErrorHandler from "../utils/Errorhandler";
import NotificationModel from "../models/notification.model";
import cron from "node-cron";

// get all notifications -- admin only
export const getAllNotifications = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const notifications = await NotificationModel.find({}).sort({ createdAt: -1 });

        res.status(201).json({
            success: true,
            notifications
        });

    } catch (error: any) {
        return next(new ErrorHandler(error.message, 500));
    }
});

// update notification status -- admin only
export const updateNotificationStatus = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    try {
        const notification = await NotificationModel.findById(req.params.id);

        if (!notification) {
            return next(new ErrorHandler("Notification not found", 404));
        } else {
            notification.status ? notification.status = "READ" : notification.status;
        }

        await notification?.save();

        const notifications = await NotificationModel.find({}).sort({ updatedAt: -1 });

        res.status(201).json({
            success: true,
            notifications
        });
    } catch (error: any) {
        return next(new ErrorHandler(error.message, 500));
    }
});

// delete notification -- only admin
cron.schedule("0 0 0 * * * ", async () => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    await NotificationModel.deleteMany({ status: "READ", createdAt: { $lt: thirtyDaysAgo } });
    console.log("Deleted read Notification");

})