import UserModel from "../models/user.model"
import { Request, Response } from "express";
import ErrorHandler from "../utils/Errorhandler";

export const getUserById = async (id: string, res: Response) => {
    const user = await UserModel.findById(id);
    res.status(201).json({
        success: true,
        user
    })
}

export const getAllUsersService = async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const users = await UserModel.find({ _id: { $ne: userId } }).sort({ createdAt: -1 });
    res.status(201).json({
        success: true,
        users
    })
}

export const updateUserRoleService = async (id: any, role: any, res: Response) => {
    const user = await UserModel.findByIdAndUpdate(id, { role: role }, { new: true });
    res.status(201).json({
        success: true,
        user,
    })

}