import Button from '../components/ui/Button.jsx';
import Card from '../components/ui/Card.jsx';
import { EmptyState } from '../components/ui/States.jsx';

export default function NotFoundPage() {
  return (
    <Card>
      <EmptyState
        icon="search"
        title="Page not found"
        description="The page you are looking for does not exist."
        action={
          <Button variant="primary" to="/">
            Go to overview
          </Button>
        }
      />
    </Card>
  );
}
