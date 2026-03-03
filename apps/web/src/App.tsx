import { JobsProvider } from './contexts/JobsContext';
import { AppLayout } from './components/layout/AppLayout';

function App() {
  return (
    <JobsProvider>
      <AppLayout />
    </JobsProvider>
  );
}

export default App;
