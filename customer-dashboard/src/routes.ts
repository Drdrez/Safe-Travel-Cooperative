import { createBrowserRouter } from "react-router";
import Landing from "./components/customer/Landing";
import CustomerLogin from "./components/customer/CustomerLogin";
import ForgotPassword from "./components/customer/ForgotPassword";
import ResetPassword from "./components/customer/ResetPassword";
import CustomerRegister from "./components/customer/CustomerRegister";
import CustomerDashboard from "./components/customer/CustomerDashboard";
import MakeReservation from "./components/customer/MakeReservation";
import MyReservations from "./components/customer/MyReservations";
import BillingPayment from "./components/customer/BillingPayment";
import TrackingPage from "./components/customer/TrackingPage";
import ProfileSettings from "./components/customer/ProfileSettings";
import Support from "./components/customer/Support";
import Membership from "./components/customer/Membership";
import CustomerLayout from "./components/customer/CustomerLayout";
import PrivacyPolicy from "./components/customer/PrivacyPolicy";
import TermsOfService from "./components/customer/TermsOfService";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Landing,
  },
  {
    path: "/privacy",
    Component: PrivacyPolicy,
  },
  {
    path: "/terms",
    Component: TermsOfService,
  },
  {
    path: "/login",
    Component: CustomerLogin,
  },
  {
    path: "/forgot-password",
    Component: ForgotPassword,
  },
  {
    path: "/reset-password",
    Component: ResetPassword,
  },
  {
    path: "/register",
    Component: CustomerRegister,
  },
  {
    path: "/customer",
    Component: CustomerLayout,
    children: [
      {
        index: true,
        Component: CustomerDashboard,
      },
      {
        path: "make-reservation",
        Component: MakeReservation,
      },
      {
        path: "reservations",
        Component: MyReservations,
      },
      {
        path: "billing",
        Component: BillingPayment,
      },
      {
        path: "tracking",
        Component: TrackingPage,
      },
      {
        path: "profile",
        Component: ProfileSettings,
      },
      {
        path: "support",
        Component: Support,
      },
      {
        path: "membership",
        Component: Membership,
      },
    ],
  },
]);
