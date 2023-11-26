import express from "express";
import { isAdmin, isAuthenticated } from "../middleware/auth";
import * as orderController from "../controllers/order.controller";

const orderRouter = express.Router();

// create order -- private route
orderRouter.post("/create-order", isAuthenticated, orderController.createOrder);

//get all orders -- admin route
orderRouter.get("/get-orders", isAuthenticated, isAdmin, orderController.getAllOrders);

orderRouter.get("/payment/stripepublishablekey", orderController.sendStripePublishableKey);

orderRouter.post("/payment", isAuthenticated, orderController.newPayment);

export default orderRouter;