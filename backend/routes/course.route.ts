import express from "express";
import * as courseController from "../controllers/course.controller";
import { isAdmin, isAuthenticated } from "../middleware/auth";
import { updateAccessToken } from "../controllers/user.controller";


const courseRouter = express.Router();

// create course
courseRouter.post("/create-course", isAuthenticated, isAdmin, courseController.uploadCourse);

//edit course 
courseRouter.post("/edit-course/:id", isAuthenticated, isAdmin, courseController.editCourse);

//get single course
courseRouter.get("/get-course/:id", courseController.getSingleCourse);

//get all courses
courseRouter.get("/get-courses", courseController.getAllCourses);

//get user course
courseRouter.get("/get-course-content/:id", isAuthenticated, courseController.getCourseByUser);

//add question
courseRouter.put("/add-question", isAuthenticated, courseController.addQuestion);

//add answer to the question
courseRouter.put("/add-answer", isAuthenticated, courseController.addAnswer);

//add review 
courseRouter.put("/add-review/:id", isAuthenticated, courseController.addReview);

// add reply to review
courseRouter.put("/add-reply", isAuthenticated, isAdmin, courseController.addReplyToReview);

// get all courses -- admin
courseRouter.get("/get-courses", isAuthenticated, isAdmin, courseController.getAllCoursesByAdmin);

// delete course -- admin route
courseRouter.delete("/delete-course/:id", isAuthenticated, isAdmin, courseController.deleteCourse);

//generate video url
courseRouter.post("/getvdourl", courseController.generateVideoUrl);

export default courseRouter;