import OcrPage from "./OcrPage";

export default async function OcrRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <OcrPage bookId={id} />;
}
