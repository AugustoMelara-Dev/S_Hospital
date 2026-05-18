import { Search } from 'lucide-react';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '../../../components/ui/tabs';
import type { Category, Service } from '../../../lib/api';

type ServiceSearchProps = {
  categories: Category[];
  services: Service[];
  selectedCategoryId: number | 'all' | undefined;
  onCategoryChange: (id: number | 'all' | undefined) => void;
  search: string;
  onSearchChange: (value: string) => void;
  scanCode: string;
  onScanCodeChange: (value: string) => void;
  onAddService: (service: Service) => void;
  onAddByScanCode: () => void;
  loading?: boolean;
};

export function ServiceSearch({
  categories,
  services,
  selectedCategoryId,
  onCategoryChange,
  search,
  onSearchChange,
  scanCode,
  onScanCodeChange,
  onAddService,
  onAddByScanCode,
  loading,
}: ServiceSearchProps) {
  const filteredServices = services.filter((service) => {
    const matchesCategory =
      selectedCategoryId === undefined ||
      selectedCategoryId === 'all' ||
      service.category_id === selectedCategoryId;

    if (!search.trim()) return matchesCategory ? service : null;

    const needle = search.toLowerCase().trim();
    const haystack = [
      service.name,
      service.category?.name ?? '',
      service.scan_code ?? '',
      service.barcode ?? '',
      service.qr_code ?? '',
    ];
    const matchesSearch = haystack.some((h) => h.toLowerCase().includes(needle));

    return matchesCategory && matchesSearch ? service : null;
  });

  return (
    <div className="space-y-4">
      <div>
        <Label className="mb-1.5 block">Categoria</Label>
        <Tabs value={selectedCategoryId === undefined ? 'all' : String(selectedCategoryId)} onValueChange={(v) => onCategoryChange(v === 'all' ? 'all' : Number(v))}>
          <TabsList className="flex flex-wrap h-auto p-1 gap-1">
            <TabsTrigger value="all">Todos</TabsTrigger>
            {categories.map((cat) => (
              <TabsTrigger key={cat.id} value={String(cat.id)}>
                {cat.name}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            aria-label="Buscar por nombre, categoria o codigo"
            placeholder="Buscar por nombre o codigo..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <div className="relative w-36">
            <Input
              aria-label="Scanner USB o codigo manual"
              placeholder="Codigo"
              value={scanCode}
              onChange={(e) => onScanCodeChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  onAddByScanCode();
                }
              }}
            />
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={() => onAddByScanCode()}>
            Escanear
          </Button>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <Label>Servicios ({filteredServices.length})</Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              onSearchChange('');
              onCategoryChange(undefined);
            }}
          >
            Limpiar
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <span>Cargando servicios...</span>
          </div>
        ) : filteredServices.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            {search || selectedCategoryId !== undefined ? 'Sin servicios encontrados' : 'Seleccione una categoria o escriba para buscar'}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[280px] overflow-y-auto pr-1">
            {filteredServices.map((service) => (
              <Button
                key={service.id}
                type="button"
                variant="outline"
                className="w-full justify-between gap-3 h-auto py-3 px-3"
                onClick={() => onAddService(service)}
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm truncate">{service.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {service.category?.name ?? 'Sin categoria'}
                    {service.scan_code ? ` - ${service.scan_code}` : ''}
                  </p>
                </div>
                <Badge variant="outline" className="shrink-0">
                  L. {service.price}
                </Badge>
                </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
