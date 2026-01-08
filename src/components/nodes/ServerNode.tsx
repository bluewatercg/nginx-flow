import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Server, MoreVertical, Trash2 } from 'lucide-react';
import { useConfig } from '@/contexts/ConfigContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface ServerNodeData {
  label: string;
  serverName: string;
  port: number;
  sslEnabled: boolean;
}

const ServerNode: React.FC<NodeProps> = ({ id, data, selected }) => {
  const { selectNode, deleteServer } = useConfig();
  const { language } = useLanguage();
  const nodeData = data as unknown as ServerNodeData;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    selectNode(id, 'server');
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    deleteServer(id);
  };

  return (
    <div
      onClick={handleClick}
      className={cn(
        'px-4 py-3 rounded-lg border-2 min-w-[200px] cursor-pointer transition-all duration-200',
        'bg-card hover:bg-muted',
        selected
          ? 'border-node-server shadow-node'
          : 'border-border hover:border-node-server/50'
      )}
    >
      <Handle
        type="source"
        position={Position.Bottom}
        className="node-handle !bg-node-server"
      />

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded bg-node-server/20">
            <Server className="w-4 h-4 text-node-server" />
          </div>
          <div>
            <div className="font-medium text-sm text-foreground">{nodeData.label}</div>
            <div className="text-xs text-muted-foreground">
              {nodeData.serverName}:{nodeData.port}
              {nodeData.sslEnabled && (
                <span className="ml-1 text-accent">🔒</span>
              )}
            </div>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-popover border-border">
            <DropdownMenuItem
              onClick={handleDelete}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              {language === 'zh' ? '删除 Server' : 'Delete Server'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};

export default memo(ServerNode);
