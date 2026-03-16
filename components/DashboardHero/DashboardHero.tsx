interface DashboardHeroProps {
  name: string;
  type?: string;
}

export default function DashboardHero({ name, type }: DashboardHeroProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        backgroundColor: 'var(--primary-color)',
        padding: '16px',
        paddingBottom: '8px',
        borderTopLeftRadius: 'var(--card-border-radius)',
        borderTopRightRadius: 'var(--card-border-radius)',
        margin: '-16px',
        minHeight: '100px',
      }}
    >
      <div>
        <h1 style={{ margin: 0, fontSize: 'calc(1.5 * var(--main-font-size))', fontWeight: 400 }}>
          {name}
        </h1>
        {type && (
          <span
            style={{
              display: 'inline-block',
              marginTop: '6px',
              padding: '2px 10px',
              borderRadius: '12px',
              fontSize: 'calc(0.7 * var(--main-font-size))',
              backgroundColor: 'var(--card-bg-color)',
              color: 'var(--main-font-color)',
            }}
          >
            {type}
          </span>
        )}
      </div>
    </div>
  );
}
