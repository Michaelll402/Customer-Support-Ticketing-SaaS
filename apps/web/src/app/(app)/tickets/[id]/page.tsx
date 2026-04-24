import { TicketDetailPage } from '@/components/tickets/ticket-detail-page';

interface TicketDetailRoutePageProps {
  params: Promise<{
    id: string;
  }>;
}

const TicketDetailRoutePage = async ({
  params,
}: TicketDetailRoutePageProps) => {
  const { id } = await params;

  return <TicketDetailPage ticketId={id} />;
};

export default TicketDetailRoutePage;
