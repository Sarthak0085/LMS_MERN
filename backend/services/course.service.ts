import { NextFunction, Response } from "express";
import { CatchAsyncError } from "../middleware/catchAsyncErrors";
import CourseModel from "../models/course.model";
import ErrorHandler from "../utils/Errorhandler";


// create course
export const createCourse = CatchAsyncError(async (data: any, res: Response, next: NextFunction) => {
    try {
        const course = await CourseModel.create(data);
        res.status(201).json({
            success: true,
            course,
        })
    } catch (error: any) {
        return next(new ErrorHandler(error.message, 500))
    }
});

// get all courses 
export const getAllCoursesService = async (res: Response) => {
    const courses = await CourseModel.find().sort({ createdAt: -1 });
    res.status(201).json({
        success: true,
        courses
    });
};