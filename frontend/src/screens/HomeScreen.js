import { useEffect, useReducer, useState } from 'react';
import axios from 'axios';
import logger from 'use-reducer-logger';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Product from '../components/Product';
import { Helmet } from 'react-helmet-async';
import LoadingBox from '../components/LoadingBox';
import MessageBox from '../components/MessageBox';
import Pagination from 'react-bootstrap/Pagination'




const reducer = (state, action) => {
  switch (action.type) {
    case 'FETCH_REQUEST':
      return { ...state, loading: true };
    case 'FETCH_SUCCESS':
      return { ...state, products: action.payload, loading: false };
    case 'FETCH_FAIL':
      return { ...state, loading: false, error: action.payload };
    default:
      return state;
  }
};

function HomeScreen() {
  const [{ loading, error, products }, dispatch] = useReducer(logger(reducer), {
    products: [],
    loading: true,
    error: '',
  });
  let items = [];
const [activePage,setActivePage] = useState(1);
const [totalPage,setTotalPage] = useState(0);
for (let number = 1; number <= totalPage; number++) {
  items.push(
    <Pagination.Item key={number} active={number === activePage} onClick={()=>setActivePage(number)}>
      {number}
    </Pagination.Item>,
  );
}

  useEffect(() => {
    const fetchData = async () => {
      dispatch({ type: 'FETCH_REQUEST' });
      try {
        const result = await axios.get(`/api/products?page=${activePage}&row=${8}`);
        setTotalPage(result.data.pageTotal);
        dispatch({ type: 'FETCH_SUCCESS', payload: result.data.productList });
      } catch (err) {
        dispatch({ type: 'FETCH_FAIL', payload: err.message });
      }
    };
    fetchData();
  }, [activePage]);
  return (
    <div>
      <Helmet>
        <title>松田车城</title>
      </Helmet>
      <h1>商品列表</h1>
      <div className="products">
        {loading ? (
          <LoadingBox />
        ) : error ? (
          <MessageBox variant="danger">{error}</MessageBox>
        ) : (
          <Row>
            {products.map((product) => (
              <Col key={product.slug} sm={6} md={4} lg={3} className="mb-3">
                <Product product={product}></Product>
              </Col>
            ))}
          </Row>
        )}
        <Pagination >{items}</Pagination>
      </div>
    </div>
  );
}
export default HomeScreen;
