import React from 'react';
import ResourcePage from '../resources/ResourcePage';
import { employeesConfig } from './config';

export default function EmployeesPage() {
	return <ResourcePage config={employeesConfig} />;
}
