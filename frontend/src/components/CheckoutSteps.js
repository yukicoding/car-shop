import React from 'react';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';

export default function CheckoutSteps(props) {
  return (
    <Row className="checkout-steps">
      <Col className={props.step1 ? 'active' : ''}>用户登录</Col>
      <Col className={props.step2 ? 'active' : ''}>完成信息</Col>
      <Col className={props.step3 ? 'active' : ''}>支付方式</Col>
      <Col className={props.step4 ? 'active' : ''}>订单确认</Col>
    </Row>
  );
}
