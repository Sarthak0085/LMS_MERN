import express from "express";
import { isAdmin, isAuthenticated } from "../middleware/auth";
import { createLayout, editLayout, getLayout } from "../controllers/layout.controller";
import { updateAccessToken } from "../controllers/user.controller";

const layoutRouter = express.Router();

// create-layout -- admin route
layoutRouter.post("/create-layout", isAuthenticated, isAdmin, createLayout);

//edit-layout -- admin route
layoutRouter.put("/edit-layout", updateAccessToken, isAuthenticated, isAdmin, editLayout);

// get layout by type -- admin route
layoutRouter.get("/get-layout/:type", getLayout);

export default layoutRouter;