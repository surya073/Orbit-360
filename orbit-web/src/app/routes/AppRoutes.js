import React, { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import AppShell from '../../components/layout/AppShell';
import LoadingState from '../../components/feedback/LoadingState';
import { ROLES, ROUTES } from '../../config/routes';
import LoginPage from '../../features/auth/LoginPage';
import DashboardPage from '../../features/dashboard/DashboardPage';
import { RequireAuth, RequireRole } from './guards';

// Module pages are code-split so the first load only ships the shell and the dashboard.
const EmployeesPage = lazy(() => import('../../features/employees/EmployeesPage'));
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

const BOTH = [ROLES.ADMIN, ROLES.MANAGER];

export default function AppRoutes() {
	return (
		<Suspense fallback={<LoadingState lines={4} label="Loading page" />}>
			<Routes>
				<Route path={ROUTES.login} element={<LoginPage />} />
				<Route element={<RequireAuth />}>
					<Route element={<RequireRole roles={BOTH} />}>
						{/* Full-screen presentation mode lives outside the application shell. */}
						<Route path={ROUTES.present()} element={<PresentationPlayer />} />
					</Route>
					<Route element={<AppShell />}>
						<Route element={<RequireRole roles={BOTH} />}>
							<Route index element={<DashboardPage />} />
							<Route path={ROUTES.employees} element={<EmployeesPage />} />
							<Route path={ROUTES.teams} element={<TeamsPage />} />
							<Route path={ROUTES.projects} element={<ProjectsPage />} />
							<Route path={ROUTES.time} element={<TimeEntriesPage />} />
							<Route path={ROUTES.attendance} element={<AttendancePage />} />
							<Route path={ROUTES.leave} element={<LeavePage />} />
							<Route path={ROUTES.performance} element={<PerformancePage />} />
							<Route path={ROUTES.usage} element={<AiUsagePage />} />
							<Route path={ROUTES.product} element={<ProductDevelopmentPage />} />
							<Route path={ROUTES.imports} element={<ImportPage />} />
							<Route path={ROUTES.spreadsheet} element={<SpreadsheetPage />} />
							<Route path={ROUTES.presentations} element={<PresentationsPage />} />
							<Route path={ROUTES.presentationNew} element={<PresentationEditor />} />
							<Route path={ROUTES.presentationEdit()} element={<PresentationEditor />} />
							<Route path={ROUTES.settings} element={<SettingsPage />} />
						</Route>
						<Route path="*" element={<Navigate to={ROUTES.dashboard} replace />} />
					</Route>
				</Route>
			</Routes>
		</Suspense>
	);
}
