import axios from 'axios';
import React, { useContext, useEffect, useReducer,useState } from 'react';
import { PayPalButtons, usePayPalScriptReducer } from '@paypal/react-paypal-js';
import { Helmet } from 'react-helmet-async';
import { useNavigate, useParams } from 'react-router-dom';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Button from 'react-bootstrap/Button';
import ListGroup from 'react-bootstrap/ListGroup';
import Card from 'react-bootstrap/Card';
import { Link } from 'react-router-dom';
import LoadingBox from '../components/LoadingBox';
import MessageBox from '../components/MessageBox';
import { Store } from '../Store';
import { getError } from '../utils';
import { toast } from 'react-toastify';
import Modal from 'react-bootstrap/Modal'

function reducer(state, action) {
  console.log(state)
  switch (action.type) {
    case 'FETCH_REQUEST':
      return { ...state, loading: true, error: '' };
    case 'FETCH_SUCCESS':
      return { ...state, loading: false, order: action.payload, error: '' };
    case 'FETCH_FAIL':
      return { ...state, loading: false, error: action.payload };
    case 'PAY_REQUEST':
      return { ...state, loadingPay: true };
    case 'PAY_SUCCESS':
      return { ...state, loadingPay: false, successPay: true };
    case 'PAY_FAIL':
      return { ...state, loadingPay: false };
    case 'PAY_RESET':
      return { ...state, loadingPay: false, successPay: false };

    case 'DELIVER_REQUEST':
      return { ...state, loadingDeliver: true };
    case 'DELIVER_SUCCESS':
      return { ...state, loadingDeliver: false, successDeliver: true };
    case 'DELIVER_FAIL':
      return { ...state, loadingDeliver: false };
    case 'DELIVER_RESET':
      return {
        ...state,
        loadingDeliver: false,
        successDeliver: false,
      };
    default:
      return state;
  }
}
export default function OrderScreen() {
  const { state } = useContext(Store);
  const { userInfo } = state;

  const params = useParams();
  const { id: orderId } = params;
  const navigate = useNavigate();

  const [
    {
      loading,
      error,
      order,
      successPay,
      loadingPay,
      loadingDeliver,
      successDeliver,
    },
    dispatch,
  ] = useReducer(reducer, {
    loading: true,
    order: {},
    error: '',
    successPay: false,
    loadingPay: false,
  });

  const [{ isPending }, paypalDispatch] = usePayPalScriptReducer();

  function createOrder(data, actions) {
    console.log(order)
    return actions.order
      .create({
        purchase_units: [
          {
            amount: { value: order.totalPrice },
          },
        ],
      })
      .then((orderID) => {
        console.log(orderID)
        return orderID;
      });
  }
  async function createAliOrder  (){
    console.log(order)
    const req = await axios.post('/api/pay/pcpay',{
      ...order
    });
    console.log(req)
    if(req.data.url){
      window.open(req.data.url)
      dispatch({ type: 'PAY_REQUEST' });
    }
  }

  function onApprove(data, actions) {
    return actions.order.capture().then(async function (details) {
      try {
        dispatch({ type: 'PAY_REQUEST' });
        const { data } = await axios.put(
          `/api/orders/${order._id}/pay`,
          details,
          {
            headers: { authorization: `Bearer ${userInfo.token}` },
          }
        );
        dispatch({ type: 'PAY_SUCCESS', payload: data });
        toast.success('订单已支付');
      } catch (err) {
        dispatch({ type: 'PAY_FAIL', payload: getError(err) });
        toast.error(getError(err));
      }
    });
  }
  function onError(err) {
    toast.error(getError(err));
  }

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        dispatch({ type: 'FETCH_REQUEST' });
        const { data } = await axios.get(`/api/orders/${orderId}`, {
          headers: { authorization: `Bearer ${userInfo.token}` },
        });
        dispatch({ type: 'FETCH_SUCCESS', payload: data });
      } catch (err) {
        dispatch({ type: 'FETCH_FAIL', payload: getError(err) });
      }
    };

    if (!userInfo) {
      return navigate('/login');
    }
    if (
      !order._id ||
      successPay ||
      successDeliver ||
      (order._id && order._id !== orderId)
    ) {
      fetchOrder();
      if (successPay) {
        console.log("successPay")
        dispatch({ type: 'PAY_RESET' });
      }
      if (successDeliver) {
        dispatch({ type: 'DELIVER_RESET' });
      }
    } else {
      // const loadPaypalScript = async () => {
      //   const { data: clientId } = await axios.get('/api/keys/paypal', {
      //     headers: { authorization: `Bearer ${userInfo.token}` },
      //   });
      //   paypalDispatch({
      //     type: 'resetOptions',
      //     value: {
      //       'client-id': clientId,
      //       currency: 'USD',
      //     },
      //   });
      //   paypalDispatch({ type: 'setLoadingStatus', value: 'pending' });
      // };
      // loadPaypalScript();
    }
  }, [
    order,
    userInfo,
    orderId,
    navigate,
    paypalDispatch,
    successPay,
    successDeliver,
  ]);

  useEffect(()=>{
       const timer = setInterval(() => {
        if(order._id&&loadingPay){
          axios.get(`/api/pay/query?order=${order._id}`).then(async (res)=>{

            if(loadingPay&&res.data.result.status===2){
              try {
                const { data } = await axios.put(
                  `/api/orders/${order._id}/pay`,
                  {
  
                  },
                  {
                    headers: { authorization: `Bearer ${userInfo.token}` },
                  }
                );
                console.log("in")
                dispatch({ type: 'PAY_SUCCESS', payload:data });
                toast.success('订单已支付');
                
              } catch (error) {
                dispatch({ type: 'PAY_FAIL', payload: getError(error) });
                toast.error(getError(error));
              }
             
            }
          })
        }
        
        
      }, 3000);
     
    
   return ()=>{
     if(timer){
      clearInterval(timer)

     }
   }

  },[loadingPay])

  async function deliverOrderHandler() {
    try {
      dispatch({ type: 'DELIVER_REQUEST' });
      const { data } = await axios.put(
        `/api/orders/${order._id}/deliver`,
        {},
        {
          headers: { authorization: `Bearer ${userInfo.token}` },
        }
      );
      dispatch({ type: 'DELIVER_SUCCESS', payload: data });
      toast.success('订单已配送');
    } catch (err) {
      toast.error(getError(err));
      dispatch({ type: 'DELIVER_FAIL' });
    }
  }
console.log(order)
  return loading ? (
    <LoadingBox></LoadingBox>
  ) : error ? (
    <MessageBox variant="danger">{error}</MessageBox>
  ) : (
    <div>
      <Helmet>
        <title>Order {orderId}</title>
      </Helmet>
      <h1 className="my-3">订单号： {orderId}</h1>
      <Row>
        <Col md={8}>
          <Card className="mb-3">
            <Card.Body>
              <Card.Title>送货信息</Card.Title>
              <Card.Text>
                <strong>姓名:</strong> {order.shippingAddress.fullName} <br />
                <strong>地址: </strong> {order.shippingAddress.address},
                {order.shippingAddress.city}, {order.shippingAddress.postalCode}
                ,{order.shippingAddress.country}
                &nbsp;
                {order.shippingAddress.location &&
                  order.shippingAddress.location.lat && (
                    <a
                      target="_new"
                      href={`https://maps.google.com?q=${order.shippingAddress.location.lat},${order.shippingAddress.location.lng}`}
                    >
                      Show On Map
                    </a>
                  )}
              </Card.Text>
              {order.isDelivered ? (
                <MessageBox variant="success">
                  送至 {order.deliveredAt}
                </MessageBox>
              ) : (
                <MessageBox variant="danger">未发货</MessageBox>
              )}
            </Card.Body>
          </Card>
          <Card className="mb-3">
            <Card.Body>
              <Card.Title>支付信息</Card.Title>
              <Card.Text>
                <strong>支付方式:</strong> {order.paymentMethod}
              </Card.Text>
              {order.isPaid ? (
                <MessageBox variant="success">
                  已支付 {order.paidAt}
                </MessageBox>
              ) : (
                <MessageBox variant="danger">未支付</MessageBox>
              )}
            </Card.Body>
          </Card>

          <Card className="mb-3">
            <Card.Body>
              <Card.Title>物品</Card.Title>
              <ListGroup variant="flush">
                {order.orderItems.map((item) => (
                  <ListGroup.Item key={item._id}>
                    <Row className="align-items-center">
                      <Col md={6}>
                        <img
                          src={item.image}
                          alt={item.name}
                          className="img-fluid rounded img-thumbnail"
                        ></img>{' '}
                        <Link to={`/product/${item.slug}`}>{item.name}</Link>
                      </Col>
                      <Col md={3}>
                        <span>{item.quantity}</span>
                      </Col>
                      <Col md={3}>￥{item.price}</Col>
                    </Row>
                  </ListGroup.Item>
                ))}
              </ListGroup>
            </Card.Body>
          </Card>
        </Col>
        <Col md={4}> 
          <Card className="mb-3">
            <Card.Body>
              <Card.Title>价格明细</Card.Title>
              <ListGroup variant="flush">
                <ListGroup.Item>
                  <Row>
                    <Col>物品</Col>
                    <Col>￥{order.itemsPrice.toFixed(2)}</Col>
                  </Row>
                </ListGroup.Item>
                <ListGroup.Item>
                  <Row>
                    <Col>运费</Col>
                    <Col>￥{order.shippingPrice.toFixed(2)}</Col>
                  </Row>
                </ListGroup.Item>
                <ListGroup.Item>
                  <Row>
                    <Col>税费</Col>
                    <Col>￥{order.taxPrice.toFixed(2)}</Col>
                  </Row>
                </ListGroup.Item>
                <ListGroup.Item>
                  <Row>
                    <Col>
                      <strong>订单总价</strong>
                    </Col>
                    <Col>
                      <strong>￥{order.totalPrice.toFixed(2)}</strong>
                    </Col>
                  </Row>
                </ListGroup.Item>
                {!order.isPaid && (
                  <ListGroup.Item>
                    {isPending ? (
                      <LoadingBox />
                    ) : (
                      <div>
                        <PayPalButtons
                          createOrder={createOrder}
                          onApprove={onApprove}
                          onError={onError}
                        ></PayPalButtons>
                        
                        {/* 支付宝 */}
                        <div style={{cursor:"pointer"}}>
                        <img src="/images/alipay.png" onClick={createAliOrder}  />
                        </div>
                        
                      </div>
                    )}
                    {/* {loadingPay && <LoadingBox></LoadingBox>} */}
                  </ListGroup.Item>
                )}
                {userInfo.isAdmin && order.isPaid && !order.isDelivered && (
                  <ListGroup.Item>
                    {loadingDeliver && <LoadingBox></LoadingBox>}
                    <div className="d-grid">
                      <Button variant="outline-primary" onClick={deliverOrderHandler}>
                        配送商品
                      </Button>
                    </div>
                  </ListGroup.Item>
                )}
              </ListGroup>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    
      <Modal show={loadingPay} fullscreen={'sm-down'} onHide={() => {
        dispatch({ type: 'PAY_SUCCESS'})
      }}>
        <Modal.Header closeButton>
          <Modal.Title>支付中</Modal.Title>
        </Modal.Header>
        <Modal.Body><LoadingBox/></Modal.Body>
      </Modal>
    
    </div>
  );
}
