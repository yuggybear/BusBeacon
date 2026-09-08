import { Outlet, useLocation, useNavigationType } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import MobileTabBar from "./MobileTabBar";

export default function Layout() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const isPop = navigationType === "POP";

  return (
    <>
      <AnimatePresence mode="wait">
        <motion.div
          key={location.pathname}
          className="pb-[64px] lg:pb-0"
          initial={isPop ? { x: "-100%", opacity: 0 } : { x: "100%", opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={isPop ? { x: "100%", opacity: 0 } : { x: "-100%", opacity: 0 }}
          transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
        >
          <Outlet />
        </motion.div>
      </AnimatePresence>
      <MobileTabBar />
    </>
  );
}