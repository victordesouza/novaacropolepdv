import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Clock } from 'lucide-react';

export default function SessionExpiry() {
  const { isSessionNearExpiry, getTimeUntilExpiry, logout } = useAuth();
  const [showWarning, setShowWarning] = useState(false);

  useEffect(() => {
    // Mostrar aviso se a sessão está próxima do fim
    setShowWarning(isSessionNearExpiry());
  }, [isSessionNearExpiry]);

  // Atualizar a cada minuto
  useEffect(() => {
    const interval = setInterval(() => {
      setShowWarning(isSessionNearExpiry());
    }, 60 * 1000);

    return () => clearInterval(interval);
  }, [isSessionNearExpiry]);

  if (!showWarning) return null;

  const timeRemaining = getTimeUntilExpiry();

  return (
    <div className="fixed top-4 right-4 z-50 max-w-sm">
      <Card className="border-amber-200 bg-amber-50 shadow-lg">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Clock className="h-5 w-5 text-amber-600 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-amber-800">
                Sessão expirando em breve
              </p>
              <p className="text-sm text-amber-700 mt-1">
                Sua sessão expirará em{' '}
                <span className="font-medium">{timeRemaining}</span>.
                Salve seu trabalho para evitar perda de dados.
              </p>
              <div className="flex gap-2 mt-3">
                <Button
                  size="sm"
                  variant="outline"
                  className="text-amber-700 border-amber-300 hover:bg-amber-100"
                  onClick={() => window.location.reload()}
                >
                  Renovar Sessão
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-amber-700 border-amber-300 hover:bg-amber-100"
                  onClick={logout}
                >
                  Logout
                </Button>
              </div>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0 text-amber-600 hover:bg-amber-100"
              onClick={() => setShowWarning(false)}
            >
              ×
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}