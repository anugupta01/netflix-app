import { Routes, Route } from 'react-router-dom';
import PrivateRoute from './PrivateRoute';
import SignIn from '../pages/SignIn';
import SignUp from '../pages/SignUp';
import Browse from '../pages/Browse';
import Watch from '../pages/Watch';
import Profiles from '../pages/Profiles';
import NotFound from '../pages/NotFound';

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/signin" element={<SignIn />} />
      <Route path="/signup" element={<SignUp />} />

      <Route element={<PrivateRoute />}>
        <Route path="/" element={<Profiles />} />
        <Route path="/browse" element={<Browse />} />
        <Route path="/watch/:contentId" element={<Watch />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
