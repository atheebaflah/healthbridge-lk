import { asgardeoMiddleware, createRouteMatcher } from '@asgardeo/nextjs/middleware';

// Pages that need login
const isProtectedRoute = createRouteMatcher(['/timeline(.*)']);

export const proxy = asgardeoMiddleware(async (asgardeo, req) => {
  if (isProtectedRoute(req)) {
    await asgardeo.protectRoute();
  }
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};