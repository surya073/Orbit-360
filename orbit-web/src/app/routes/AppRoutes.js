import React, { Suspense, lazy } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import AppShell from '../../components/layout/AppShell';
import LoadingState from '../../components/feedback/LoadingState';
import { firstDestination } from '../../config/navigation';
import { ROUTES } from '../../config/routes';
import LoginPage from '../../features/auth/LoginPage';
import DashboardPage from '../../features/dashboard/DashboardPage';
import { useAuth } from '../providers/AuthProvider';
import { RequireAuth, RequirePermission } from './guards';

// Module pages are code-split so the first load only ships the shell and the dashboard.
const EmployeesPage = lazy(() => import('../../features/employees/EmployeesPage'));
const ReportingBuilderPage = lazy(() => import('../../features/reporting/ReportingBuilderPage'));
const TeamsPage = lazy(() => import('../../features/teams/TeamsPage'));
const ProjectsPage = lazy(() => import('../../features/projects/ProjectsPage'));
const TimeEntriesPage = lazy(() => import('../../features/time-entries/TimeEntriesPage'));
const AttendancePage = lazy(() => import('../../features/attendance/AttendancePage'));
const LeavePage = lazy(() => import('../../features/leave/LeavePage'));
const PerformancePage = lazy(() => import('../../features/performance/PerformancePage'));
const AiUsagePage = lazy(() => import('../../features/ai-usage/AiUsagePage'));
const ProductDevelopmentPage = lazy(() => import('../../features/product-development/ProductDevelopmentPage'));
const ImportPage = lazy(() => import('../../features/imports/ImportPage'));
const SpreadsheetPage = lazy(() => import('../../features/spreadsheet/SpreadsheetPage'));
const PresentationsPage = lazy(() => import('../../features/presentations/PresentationsPage'));
const PresentationEditor = lazy(() => import('../../features/presentations/PresentationEditor'));
const PresentationPlayer = lazy(() => import('../../features/presentations/PresentationPlayer'));
const SettingsPage = lazy(() => import('../../features/settings/SettingsPage'));
const AccessPage = lazy(() => import('../../features/access/AccessPage'));

/** A page behind a permission. UX only: every API call behind it is authorized again by the backend. */
const guard = (permission, element) => <RequirePermission permission={permission}>{element}</RequirePermission>;

/** The sign-in page, unless the user is already signed in (then straight back to where they were going, or home). */
function LoginRoute() {
	const { status } = useAuth();
	const location = useLocation();
	if (status === 'ready') return <Navigate to={(location.state && location.state.from && location.state.from.pathname) || ROUTES.dashboard} replace />;
	return <LoginPage />;
}

/** "Home": the Dashboard when allowed, otherwise the first page this user may open. */
function Home() {
	const { can } = useAuth();
	if (can('dashboard.view')) return <DashboardPage />;
	const first = firstDestination(can);
	if (first) return <Navigate to={first} replace />;
	return (
		<p className="banner banner--warning" role="alert">
			Your role does not have access to any page yet. Ask an administrator to update your access.
		</p>
	);
}

export default function AppRoutes() {
	return (
		<Suspense fallback={<LoadingState lines={4} label="Loading page" />}>
			<Routes>
				<Route path={ROUTES.login} element={<LoginRoute />} />
				<Route element={<RequireAuth />}>
					{/* Full-screen presentation mode lives outside the application shell. */}
					<Route path={ROUTES.present()} element={guard('presentations.view', <PresentationPlayer />)} />
					<Route element={<AppShell />}>
						<Route index element={<Home />} />
						<Route path={ROUTES.employees} element={guard('employees.view', <EmployeesPage />)} />
						<Route path={ROUTES.reporting} element={guard(['reporting.view', 'employees.view'], <ReportingBuilderPage />)} />
						<Route path={ROUTES.teams} element={guard('teams.view', <TeamsPage />)} />
						<Route path={ROUTES.projects} element={guard('projects.view', <ProjectsPage />)} />
						<Route path={ROUTES.time} element={guard('time_entries.view', <TimeEntriesPage />)} />
						<Route path={ROUTES.attendance} element={guard('attendance.view', <AttendancePage />)} />
						<Route path={ROUTES.leave} element={guard('leave.view', <LeavePage />)} />
						<Route path={ROUTES.performance} element={guard('performance.view', <PerformancePage />)} />
						<Route path={ROUTES.usage} element={guard('ai_usage.view', <AiUsagePage />)} />
						<Route path={ROUTES.product} element={guard('product.view', <ProductDevelopmentPage />)} />
						<Route path={ROUTES.imports} element={guard('imports.view', <ImportPage />)} />
						<Route path={ROUTES.spreadsheet} element={guard('spreadsheet.view', <SpreadsheetPage />)} />
						<Route path={ROUTES.presentations} element={guard('presentations.view', <PresentationsPage />)} />
						<Route path={ROUTES.presentationNew} element={guard(['presentations.view', 'presentations.create'], <PresentationEditor />)} />
						<Route path={ROUTES.presentationEdit()} element={guard(['presentations.view', 'presentations.edit'], <PresentationEditor />)} />
						<Route path={ROUTES.access} element={guard('access.view', <AccessPage />)} />
						{/* Personal preferences (appearance, layout, profile): available to every signed-in user. */}
						<Route path={ROUTES.settings} element={<SettingsPage />} />
						<Route path="*" element={<Navigate to={ROUTES.dashboard} replace />} />
					</Route>
				</Route>
			</Routes>
		</Suspense>
	);
}
