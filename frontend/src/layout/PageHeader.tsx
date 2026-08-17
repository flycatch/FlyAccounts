import "./PageHeader.css";

type PageHeaderProps = {
  title: string;
};

export function PageHeader({ title }: PageHeaderProps) {
  return (
    <header className="page-header">
      <h1 className="page-header-title">{title}</h1>
    </header>
  );
}
