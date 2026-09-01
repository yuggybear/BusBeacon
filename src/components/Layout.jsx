import { Outlet, useLocation, useNavigationType } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import MobileTabBar from "./MobileTabBar";

export default function Layout() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const isBackNavigation = navigationType === "POP";

  const transitionProps = isBackNavigation
    ? {
        initial: { x: "-100%", opacity: 0 },
        animate: { x: 0, opacity: 1 },
        exit: { x: "100%", opacity: 0 },
      }
    : {
        initial: { x: "100%", opacity: 0 },
        animate: { x: 0, opacity: 1 },
        exit: { x: "-100%", opacity: 0 },
      };

  return (
    <>
      <AnimatePresence mode="wait">
        <motion.div
          key={location.pathname}
          initial={transitionProps.initial}
          animate={transitionProps.animate}
          exit={transitionProps.exit}
          transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        >
          <Outlet />
        </motion.div>
      </AnimatePresence>
      <MobileTabBar />
    </>
  );
}