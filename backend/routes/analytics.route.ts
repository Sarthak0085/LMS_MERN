import express from "express";
import { isAdmin, isAuthenticated } from "../middleware/auth";
import * as analyticsController from "../controllers/analytics.controller";

const analyticsRouter = express.Router();

// user analytics -- only for admin
analyticsRouter.get("/get-users-analytics", isAuthenticated, isAdmin, analyticsController.getUserAnalytics);

// order analytics -- only for admin
analyticsRouter.get("/get-orders-analytics", isAuthenticated, isAdmin, analyticsController.getOrderAnalytics);

// course analytics -- only for admin
analyticsRouter.get("/get-courses-analytics", isAuthenticated, isAdmin, analyticsController.getCourseAnalytics);

export default analyticsRouter;