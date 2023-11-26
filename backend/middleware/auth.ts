import { NextFunction, Request, Response } from "express";
import { CatchAsyncError } from "./catchAsyncErrors";
import dotenv from "dotenv";
import ErrorHandler from "../utils/Errorhandler";
import jwt, { JwtPayload } from "jsonwebtoken";
import { redis } from "../utils/redis";

dotenv.config();

export const isAuthenticated = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    const access_token = req.cookies.access_token;

    if (!access_token) {
        return next(new ErrorHandler("Please login to access this", 400));
    }

    const decoded = jwt.verify(access_token, process.env.ACCESS_TOKEN as string) as JwtPayload;

    if (!decoded) {
        return next(new ErrorHandler("Access token is not valid", 400));
    }

    const user = await redis.get(decoded.id);

    if (!user) {
        return next(new ErrorHandler("Please login to access this resource", 400));
    }

    req.user = JSON.parse(user);

    next();
})


export const authorizeRole = (...roles: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        if (!roles.includes(req.user?.role || '')) {
            return next(new ErrorHandler(`Role : ${req.user?.role} is not allowed to access this resource`, 400));
        }

        next();
    }
}

export const isAdmin = CatchAsyncError(async (req: Request, res: Response, next: NextFunction) => {
    if (!(req.user?.role === "ADMIN")) {
        return next(new ErrorHandler("Not Authorized as Admin", 400));
    }
    next();
})