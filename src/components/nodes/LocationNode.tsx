import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { MapPin, MoreVertical, Trash2, CheckCircle2, ArrowRight } from 'lucide-react';
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

interface LocationNodeData {
  label: string;
  path: string;
  modifier: string;
  hasProxy: boolean;
  isMatched?: boolean;
  priorityLabel?: string;
  matchReason?: string;
}

const LocationNode: React.FC<NodeProps> = ({ id, data, selected }) => {
  const { selectNode, deleteLocation } = useConfig();
  const { language, t } = useLanguage();
  const nodeData = data as unknown as LocationNodeData;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    selectNode(id, 'location');
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    deleteLocation(id);
  };

  const displayPath = nodeData.modifier 
    ? `${nodeData.modifier} ${nodeData.path}` 
    : nodeData.path;

  // Get modifier label for display
  const getModifierBadge = () => {
    switch (nodeData.modifier) {
      case '=': return { label: '精确', color: 'bg-red-500/20 text-red-400' };
      case '^~': return { label: '前缀优先', color: 'bg-orange-500/20 text-orange-400' };
      case '~': return { label: '正则', color: 'bg-purple-500/20 text-purple-400' };
      case '~*': return { label: '正则(i)', color: 'bg-purple-500/20 text-purple-400' };
      default: return { label: '前缀', color: 'bg-slate-500/20 text-slate-400' };
    }
  };

  const modifierBadge = getModifierBadge();

  return (
    <div className="relative">
      {/* Match tooltip with detailed reason */}
      {nodeData.isMatched && (
        <div className="absolute -top-16 left-1/2 -translate-x-1/2 z-10 animate-fade-in">
          <div className="flex flex-col items-center gap-1 px-3 py-2 rounded-lg bg-green-500/90 text-white text-xs font-medium shadow-lg whitespace-nowrap">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{nodeData.priorityLabel}</span>
            </div>
            {nodeData.matchReason && (
              <div className="text-[10px] opacity-90 font-mono">
                {nodeData.matchReason}
              </div>
            )}
          </div>
        </div>
      )}
      
      <div
        onClick={handleClick}
        className={cn(
          'px-4 py-3 rounded-2xl border-2 min-w-[200px] cursor-pointer transition-all duration-200',
          'bg-gradient-to-br from-card to-muted/50 hover:from-muted hover:to-muted',
          nodeData.isMatched
            ? 'border-green-500 shadow-[0_4px_20px_-4px_hsl(142_76%_50%/0.5)] ring-2 ring-green-500/30'
            : selected
              ? 'border-node-location shadow-[0_4px_20px_-4px_hsl(160_84%_39%/0.4)] ring-1 ring-node-location/20'
              : 'border-node-location/30 hover:border-node-location/60'
        )}
      >
        <Handle
          type="target"
          position={Position.Top}
          className="node-handle !bg-node-location"
        />
        <Handle
          type="source"
          position={Position.Bottom}
          className="node-handle !bg-node-location"
        />

        <div className="flex flex-col gap-2">
          {/* Header row with icon and menu */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className={cn(
                "p-1.5 rounded-lg",
                nodeData.isMatched ? "bg-green-500/20" : "bg-node-location/15"
              )}>
                <MapPin className={cn(
                  "w-4 h-4",
                  nodeData.isMatched ? "text-green-500" : "text-node-location"
                )} />
              </div>
              <span className={cn(
                "text-[10px] font-medium px-2 py-0.5 rounded-full",
                modifierBadge.color
              )}>
                {modifierBadge.label}
              </span>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-60 hover:opacity-100"
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
                  {language === 'zh' ? '删除 Location' : 'Delete Location'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Path display */}
          <div className="font-mono text-sm text-foreground font-medium">
            {nodeData.path}
          </div>

          {/* Type indicator */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ArrowRight className="w-3 h-3" />
            <span>{nodeData.hasProxy ? 'Proxy' : 'Static'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default memo(LocationNode);
