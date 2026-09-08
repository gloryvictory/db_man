import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Select, Loader, Center, Text } from '@mantine/core';
import { useStore } from '../store';
import { api } from '../api';
import type { StatsRow } from '../types';

export default function Overview() {
  const store = useStore();
  const [dbs, setDbs] = useState<string[]>([]);
  const [db, setDb] = useState<string | null>(null);
  const [stats, setStats] = useState<StatsRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!store.connected || !store.activeConnId) return;
    api.databases(store.activeConnId).then((list) => {
      setDbs(list);
      if (list.length && !db) setDb(list[0]);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.connected, store.activeConnId]);

  useEffect(() => {
    if (!db || !store.activeConnId) return;
    setLoading(true);
    api
      .stats(store.activeConnId, db)
      .then((s) => {
        setStats(s);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [db, store.activeConnId]);

  if (!store.connected) {
    return (
      <Center className="h-full">
        <Text c="dimmed" size="sm">
          Подключитесь к базе данных, чтобы увидеть обзор.
        </Text>
      </Center>
    );
  }

  const data = stats.slice(0, 15).map((s) => ({ name: `${s.schema}.${s.name}`, rows: s.rows }));

  return (
    <div className="h-full p-6">
      <div className="mb-4 flex items-center gap-3">
        <h1 className="text-lg font-semibold">Крупнейшие таблицы (оценка)</h1>
        <Select
          size="xs"
          w={200}
          data={dbs}
          value={db}
          onChange={setDb}
          placeholder="База данных"
        />
      </div>

      {loading ? (
        <Center className="h-[420px]">
          <Loader color="#35c98e" />
        </Center>
      ) : data.length === 0 ? (
        <Center className="h-[420px]">
          <Text c="dimmed" size="sm">
            Нет таблиц для отображения.
          </Text>
        </Center>
      ) : (
        <div className="h-[480px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid stroke="#272c39" horizontal={false} />
              <XAxis type="number" stroke="#5c6478" tick={{ fill: '#8b93a7', fontSize: 11 }} />
              <YAxis
                type="category"
                dataKey="name"
                width={190}
                stroke="#5c6478"
                tick={{ fill: '#8b93a7', fontSize: 11, fontFamily: 'monospace' }}
              />
              <Tooltip
                contentStyle={{
                  background: '#1b1e26',
                  border: '1px solid #272c39',
                  color: '#e7eaf0',
                  borderRadius: 8,
                }}
                formatter={(v) => [Number(v).toLocaleString('ru-RU'), 'строк']}
              />
              <Bar dataKey="rows" fill="#35c98e" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
