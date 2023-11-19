import { lazy } from 'react';
import { Navigate } from 'react-router-dom';
import lazyWithReducer from 'app/store/lazyWithReducer';
import reducer from './store';

const ECommerceApp = lazyWithReducer('eCommerceApp', () => import('./ECommerceApp'), reducer);
const Product = lazy(() => import('./product/Product'));
const Products = lazy(() => import('./products/Products'));
const User = lazy(() => import('./user/User'));
const Users = lazy(() => import('./users/Users'));

/**
 * The E-Commerce app configuration.
 */
const ECommerceAppConfig = {
	settings: {
		layout: {}
	},
	routes: [
		{
			path: 'dashboards/tasks',
			element: <ECommerceApp />,
			children: [
				{
					path: 'users',
					element: <Users />
				},
				{
					path: 'users/:userId',
					element: <User />
				}
			]
		}
	]
};

export default ECommerceAppConfig;
