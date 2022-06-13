
import express from 'express';
import expressAsyncHandler from 'express-async-handler';
const payRouter = express.Router();
import axios from 'axios'
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const AlipayFormData = require("alipay-sdk/lib/form").default;
import ALI_CONSTANT from "../config/alipy.js"
const  AlipaySdk  = require('alipay-sdk').default
const alipaySdk = new AlipaySdk({
    appId: ALI_CONSTANT.ALI_APPID, // 开放平台上创建应用时生成的 appId
    gateway: ALI_CONSTANT.GATEWAY, // 支付宝网关地址 ，沙箱环境下使用时需要修改
    //alipayPublicKey: 'public_key', // 支付宝公钥，需要对结果验签时候必填
    privateKey: ALI_CONSTANT.ALI_PRIVATE_KEY,
});


payRouter.post('/pcpay', expressAsyncHandler((req, res) => {
    
    (async () => {        // 调用 setMethod 并传入 get，会返回可以跳转到支付页面的 url
        const {_id,orderItems,itemsPrice,totalPrice}  = req.body
        const formData = new AlipayFormData();
        formData.setMethod('get');
        console.log(_id,orderItems,itemsPrice)
        // 通过 addField 增加参数
        // 在用户支付完成之后，支付宝服务器会根据传入的 notify_url，以 POST 请求的形式将支付结果作为参数通知到商户系统。
        formData.addField('notifyUrl', 'https://www.baidu.com'); // 支付成功回调地址，必须为可以直接访问的地址，不能带参数
        formData.addField('bizContent', {
            outTradeNo: _id, // 商户订单号,64个字符以内、可包含字母、数字、下划线,且不能重复
            productCode: 'FAST_INSTANT_TRADE_PAY', // 销售产品码，与支付宝签约的产品码名称,仅支持FAST_INSTANT_TRADE_PAY
            totalAmount: totalPrice, // 订单总金额，单位为元，精确到小数点后两位
            subject:'Macbook Pro' , // 订单标题
            body: 'Macbook Pro', // 订单描述
        });        // 如果需要支付后跳转到商户界面，可以增加属性"returnUrl"
        const result = await alipaySdk.exec(
            'alipay.trade.page.pay', // 统一收单下单并支付页面接口
            {}, // api 请求的参数（包含“公共请求参数”和“业务参数”）
            {formData: formData},);        // result 为可以跳转到支付链接的 url
        res.json({url: result});
    })();
  }));

  payRouter.get('/query', expressAsyncHandler((req, res) => {
    
    (async () => {        // 调用 setMethod 并传入 get，会返回可以跳转到支付页面的 url
        const {order}  = req.query
        const formData = new AlipayFormData();
        formData.setMethod('get');
        // console.log(_id,orderItems,itemsPrice)
        // // 通过 addField 增加参数
        // // 在用户支付完成之后，支付宝服务器会根据传入的 notify_url，以 POST 请求的形式将支付结果作为参数通知到商户系统。
        // formData.addField('notifyUrl', 'https://www.baidu.com'); // 支付成功回调地址，必须为可以直接访问的地址，不能带参数
        formData.addField('bizContent', {
            outTradeNo: order, // 商户订单号,64个字符以内、可包含字母、数字、下划线,且不能重复
           
        });        // 如果需要支付后跳转到商户界面，可以增加属性"returnUrl"
        const result = await alipaySdk.exec(
            'alipay.trade.query', 
            {
            }, // api 请求的参数（包含“公共请求参数”和“业务参数”）
            {formData: formData},
            );        // result 为可以跳转到支付链接的 url
        // res.json({url: result});
        // console.log(result)
        axios.get(result).then(data=>{
            let r = data.data.alipay_trade_query_response;
            if(r.code === '10000') { // 接口调用成功
              switch(r.trade_status) {
                case 'WAIT_BUYER_PAY':
                  res.send(
                    {
                      "success": true,
                      "message": "success",
                      "code": 200,
                      "timestamp": (new Date()).getTime(),
                      "result": {
                        "status":0,
                        "massage":'交易创建，等待买家付款'
                      }
                    }
                  )
                  break;
                case 'TRADE_CLOSED':
                  res.send(
                    {
                      "success": true,
                      "message": "success",
                      "code": 200,
                      "timestamp": (new Date()).getTime(),
                      "result": {
                        "status":1,
                        "massage":'未付款交易超时关闭，或支付完成后全额退款'
                      }
                    }
                  )
                  break;
                case 'TRADE_SUCCESS':
                  res.send(
                    {
                      "success": true,
                      "message": "success",
                      "code": 200,
                      "timestamp": (new Date()).getTime(),
                      "result": {
                        "status":2,
                        "massage":'交易支付成功'
                      }
                    }
                  )
                  break;
                case 'TRADE_FINISHED':
                  res.send(
                    {
                      "success": true,
                      "message": "success",
                      "code": 200,
                      "timestamp": (new Date()).getTime(),
                      "result": {
                        "status":3,
                        "massage":'交易结束，不可退款'
                      }
                    }
                  )
                  break;
              }
            } else if(r.code === '40004') {
                res.send(
                    {
                      "success": true,
                      "message": "success",
                      "code": 200,
                      "timestamp": (new Date()).getTime(),
                      "result": {
                        "status":-1,
                        "massage":'交易不存在'
                      }
                    }
                  )
            }
      

        })

    })();
  }));

  export default payRouter;