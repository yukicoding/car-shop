import express from 'express';
import expressAsyncHandler from 'express-async-handler';
import Order from '../models/orderModel.js';
import User from '../models/userModel.js';
import Product from '../models/productModel.js';
import { isAuth, isAdmin, mailgun, payOrderEmailTemplate } from '../utils.js';
import mongoose from 'mongoose'


const orderRouter = express.Router();

orderRouter.get(
  '/',
  isAuth,
  isAdmin,
  expressAsyncHandler(async (req, res) => {
    const orders = await Order.find().populate('user', 'name');
    res.send(orders);
  })
);

orderRouter.post(
  '/',
  isAuth,
  expressAsyncHandler(async (req, res) => {
    let orderItems = req.body.orderItems.map((x) => ({ ...x, product: x._id }))
    function formatOrdersItem(orderItems) {
      let result = [];
      orderItems.forEach((item)=>{
        result.push({_id:item._id})
      })
      return result;
    }
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const filterArr = formatOrdersItem(orderItems);
      const newOrder = new Order({
        orderItems,
        shippingAddress: req.body.shippingAddress,
        paymentMethod: req.body.paymentMethod,
        itemsPrice: req.body.itemsPrice,
        shippingPrice: req.body.shippingPrice,
        taxPrice: req.body.taxPrice,
        totalPrice: req.body.totalPrice,
        user: req.user._id,
      });
      let product = await Product.find({$or:[...filterArr]},null,{session});
      let isSuccess = product.every((item)=>item.countInStock>0);
      if(!isSuccess) throw Error("未知错误导致购买失败，请联系客服");
      const order = await newOrder.save();
    res.status(201).send({ message: 'New Order Created', order });
    await session.commitTransaction();
    } catch (error) {
       // Rollback any changes made in the database
    await session.abortTransaction();

    // logging the error
    console.error(error);

    // Rethrow the error
    throw error;
    }finally {
      // Ending the session
      session.endSession();
    }
   
    // orderItems.forEach( (item)=>{
    //   let product = await Product.find({_id:item._id})
    //   console.log(product)
    //   result.push(...product)
    // })

  })
);

orderRouter.get(
  '/summary',
  isAuth,
  isAdmin,
  expressAsyncHandler(async (req, res) => {
    const orders = await Order.aggregate([
      {
        $group: {
          _id: null,
          numOrders: { $sum: 1 },
          totalSales: { $sum: '$totalPrice' },
        },
      },
    ]);
    const users = await User.aggregate([
      {
        $group: {
          _id: null,
          numUsers: { $sum: 1 },
        },
      },
    ]);
    const dailyOrders = await Order.aggregate([
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          orders: { $sum: 1 },
          sales: { $sum: '$totalPrice' },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    const productCategories = await Product.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
        },
      },
    ]);
    res.send({ users, orders, dailyOrders, productCategories });
  })
);

orderRouter.get(
  '/mine',
  isAuth,
  expressAsyncHandler(async (req, res) => {
    const orders = await Order.find({ user: req.user._id });
    res.send(orders);
  })
);

orderRouter.get(
  '/:id',
  isAuth,
  expressAsyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id);
    if (order) {
      res.send(order);
    } else {
      res.status(404).send({ message: 'Order Not Found' });
    }
  })
);

orderRouter.put(
  '/:id/deliver',
  isAuth,
  expressAsyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id);
    if (order) {
      order.isDelivered = true;
      order.deliveredAt = Date.now();
      await order.save();
      res.send({ message: 'Order Delivered' });
    } else {
      res.status(404).send({ message: 'Order Not Found' });
    }
  })
);

orderRouter.put(
  '/:id/pay',
  isAuth,
  expressAsyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id).populate(
      'user',
      'email name'
    );
    if (order) {
      order.isPaid = true;
      order.paidAt = Date.now();
      order.paymentResult = {
        id: req.body.id,
        status: req.body.status,
        update_time: req.body.update_time,
        email_address: req.body.email_address,
      };

      const updatedOrder = await order.save();
      // mailgun()
      //   .messages()
      //   .send(
      //     {
      //       from: 'Amazona <amazona@mg.yourdomain.com>',
      //       to: `${order.user.name} <${order.user.email}>`,
      //       subject: `New order ${order._id}`,
      //       html: payOrderEmailTemplate(order),
      //     },
      //     (error, body) => {
      //       if (error) {
      //         console.log(error);
      //       } else {
      //         console.log(body);
      //       }
      //     }
      //   );

      res.send({ message: 'Order Paid', order: updatedOrder });
    } else {
      res.status(404).send({ message: 'Order Not Found' });
    }
  })
);

orderRouter.delete(
  '/:id',
  isAuth,
  isAdmin,
  expressAsyncHandler(async (req, res) => {
    const order = await Order.findById(req.params.id);
    if (order) {
      await order.remove();
      res.send({ message: 'Order Deleted' });
    } else {
      res.status(404).send({ message: 'Order Not Found' });
    }
  })
);

orderRouter.post('/pcpay', expressAsyncHandler((req, res) => {
  (async () => {        // 调用 setMethod 并传入 get，会返回可以跳转到支付页面的 url
      const formData = new AlipayFormData();
      formData.setMethod('get');
      // 通过 addField 增加参数
      // 在用户支付完成之后，支付宝服务器会根据传入的 notify_url，以 POST 请求的形式将支付结果作为参数通知到商户系统。
      formData.addField('notifyUrl', 'http://www.com/notify'); // 支付成功回调地址，必须为可以直接访问的地址，不能带参数
      formData.addField('bizContent', {
          outTradeNo: req.body.outTradeNo, // 商户订单号,64个字符以内、可包含字母、数字、下划线,且不能重复
          productCode: 'FAST_INSTANT_TRADE_PAY', // 销售产品码，与支付宝签约的产品码名称,仅支持FAST_INSTANT_TRADE_PAY
          totalAmount: '0.01', // 订单总金额，单位为元，精确到小数点后两位
          subject: '商品', // 订单标题
          body: '商品详情', // 订单描述
      });        // 如果需要支付后跳转到商户界面，可以增加属性"returnUrl"
      const result = await alipaySdk.exec(
          'alipay.trade.page.pay', // 统一收单下单并支付页面接口
          {}, // api 请求的参数（包含“公共请求参数”和“业务参数”）
          {formData: formData},);        // result 为可以跳转到支付链接的 url
      res.json({url: result});
  })();
}));

export default orderRouter;
