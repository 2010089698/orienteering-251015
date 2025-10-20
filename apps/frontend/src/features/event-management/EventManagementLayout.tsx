import { Link, Route, Routes } from 'react-router-dom';
import { StatusMessage } from '@orienteering/shared-ui';

import { EventManagementProvider } from './state';
import EventListPage from './pages/EventListPage';
import EventDetailPage from './pages/EventDetailPage';

const NotFound = () => {
  return (
    <div className="event-management__not-found">
      <StatusMessage tone="warning" message="ページが見つかりません。" />
      <p>
        <Link to="/events">イベント一覧に戻る</Link>
      </p>
    </div>
  );
};

const EventManagementLayout = () => {
  return (
    <EventManagementProvider>
      <Routes>
        <Route index element={<EventListPage />} />
        <Route path=":eventId" element={<EventDetailPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </EventManagementProvider>
  );
};

export default EventManagementLayout;
