import { createRoute, lazyRouteComponent } from '@tanstack/react-router'
import { Route as RootRoute } from '../../../__root'
// `sixth-perks_` keeps the planner a sibling of the catalog route rather than its child.
export const Route = createRoute({ getParentRoute: () => RootRoute, path: '/stw-operations/sixth-perks/completion', component: lazyRouteComponent(() => import('./-page'), 'RouteComponent') })
