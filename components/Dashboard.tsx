'use client';

import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  ArrowUpCircle, 
  ArrowDownCircle, 
  Clock, 
  AlertCircle, 
  Plus, 
  History, 
  FileText, 
  LayoutGrid,
  MoreVertical,
  Search,
  X,
  CheckCircle2,
  Upload,
  LogOut,
  Trash2,
  Filter,
  RefreshCcw,
  UserPlus,
  Lock,
  FileSpreadsheet,
  Wallet,
  Printer,
  Key
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { useAuth } from '@/hooks/useAuth';
import { generateId } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

const INITIAL_TRANSACTIONS = [
  { id: '1', responsible: 'João Pedro (motorista)', description: 'Devolução de troco: Viagem para despesa', amount: 100, type: 'ENTRADA', date: '15 ABR 2026', timestamp: '2026-04-15T10:00:00Z', status: 'COMPLETED' },
  { id: '2', responsible: 'João Pedro (motorista)', description: 'Viagem para despesa', amount: -500, type: 'SAIDA', date: '15 ABR 2026', timestamp: '2026-04-15T09:00:00Z', status: 'AWAITING_SETTLEMENT' },
  { id: '3', responsible: 'João Pedro', description: 'Reembolso: Viagem para entrega', amount: -100, type: 'SAIDA', date: '15 ABR 2026', timestamp: '2026-04-15T08:00:00Z', status: 'AWAITING_REIMBURSEMENT' },
  { id: '4', responsible: 'João Pedro', description: 'Viagem para entrega', amount: -1000, type: 'SAIDA', date: '15 ABR 2026', timestamp: '2026-04-15T07:00:00Z', status: 'AWAITING_SETTLEMENT' },
  { id: '5', responsible: 'Neia', description: 'TST-0998872728', amount: 5000, type: 'ENTRADA', date: '15 ABR 2026', timestamp: '2026-04-15T06:00:00Z', status: 'COMPLETED' },
];

declare global {
  var __isFetchingInitialData: boolean;
}

export default function Dashboard() {
  const { user, profile, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [initialBalance, setInitialBalance] = useState<number>(5100);
  const [lastClosingDate, setLastClosingDate] = useState<string | null>(null);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [newUser, setNewUser] = useState({
    email: '',
    name: '',
    role: 'FINANCEIRO',
    password: ''
  });
  const [isSettlementOpen, setIsSettlementOpen] = useState(false);
  const [isReimbursementOpen, setIsReimbursementOpen] = useState(false);
  const [isPendingListOpen, setIsPendingListOpen] = useState(false);
  const [isClosingDialogOpen, setIsClosingDialogOpen] = useState(false);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [isReopenDialogOpen, setIsReopenDialogOpen] = useState(false);
  const [isPeriodReportDialogOpen, setIsPeriodReportDialogOpen] = useState(false);
  const [reportStartDate, setReportStartDate] = useState<string>('');
  const [reportEndDate, setReportEndDate] = useState<string>('');
  const [closingStep, setClosingStep] = useState<'CONFIRM' | 'PENDING_CHOICE'>('CONFIRM');
  const [pendingListType, setPendingListType] = useState<'SETTLEMENT' | 'REIMBURSEMENT' | null>(null);
  const [selectedTx, setSelectedTx] = useState<any>(null);
  const [settlementData, setSettlementData] = useState({
    amountSpent: '',
    attachments: [] as string[]
  });
  const [newTx, setNewTx] = useState({
    type: 'SAIDA',
    amount: '',
    responsible: '',
    description: '',
    requiresSettlement: true
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string | null>('ALL');
  const [filterStatus, setFilterStatus] = useState<string | null>('ALL');
  const [filterPeriod, setFilterPeriod] = useState<string | null>('OPEN');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const isAdmin = profile?.role === 'ADMIN';
  const isFinanceiro = profile?.role === 'FINANCEIRO' || isAdmin;

  const translateStatus = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'Finalizado';
      case 'AWAITING_SETTLEMENT': return 'Pendente Prestação';
      case 'AWAITING_REIMBURSEMENT': return 'Pendente Reembolso';
      case 'CANCELLED': return 'Cancelado';
      default: return status;
    }
  };

  const exportToExcel = (options: { onlyOpen?: boolean, dateRange?: { start: string, end: string } } = {}) => {
    const { onlyOpen, dateRange } = options;
    let targetTransactions = onlyOpen ? transactions.filter(t => !t.closed) : transactions;
    
    if (dateRange && dateRange.start && dateRange.end) {
      const start = new Date(dateRange.start);
      const end = new Date(dateRange.end);
      end.setHours(23, 59, 59, 999);
      
      targetTransactions = targetTransactions.filter(t => {
        const tDate = new Date(t.timestamp);
        return tDate >= start && tDate <= end;
      });
    }

    // Summary Data for historical/period reports might need separate calculation if we want accurate balances for that period
    // But for now, let's keep the current summary or a simplified one for period reports
    const summaryData = [
      { "Resumo Financeiro": "Saldo Inicial", "Valor": `R$ ${initialBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` },
      { "Resumo Financeiro": "Total de Entradas", "Valor": `R$ ${totalIn.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` },
      { "Resumo Financeiro": "Total de Saídas", "Valor": `R$ ${totalOut.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` },
      { "Resumo Financeiro": "Devoluções ao Caixa", "Valor": `R$ ${totalReturned.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` },
      { "Resumo Financeiro": "Reembolsos Pagos", "Valor": `R$ ${totalRefunded.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` },
      { "Resumo Financeiro": "Resultado Líquido", "Valor": `R$ ${(totalIn - totalOut).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` },
      { "Resumo Financeiro": "Saldo Atual", "Valor": `R$ ${balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` },
    ];

    // Transactions Data
    const data = targetTransactions.map(tx => ({
      Data: tx.date,
      Responsável: tx.responsible,
      Descrição: tx.description,
      Tipo: tx.type === 'ENTRADA' ? 'Entrada' : 'Saída',
      Valor: `R$ ${Math.abs(tx.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      Status: translateStatus(tx.status),
      Consolidado: tx.closed ? 'Sim' : 'Não'
    }));

    const workbook = XLSX.utils.book_new();
    
    const summarySheet = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summarySheet, "Resumo Financeiro");

    const worksheet = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(workbook, worksheet, "Movimentações");
    
    const fileName = dateRange 
      ? `Relatorio_Periodo_${dateRange.start}_a_${dateRange.end}`
      : (onlyOpen ? `Fechamento_Caixinha_${new Date().getMonth() + 1}_${new Date().getFullYear()}` : `Relatorio_Geral_Caixinha`);
    
    XLSX.writeFile(workbook, `${fileName}.xlsx`);
    toast.success("Relatório Excel exportado com sucesso!");
  };

  const generatePDF = (options: { onlyOpen?: boolean, dateRange?: { start: string, end: string } } = {}) => {
    const { onlyOpen, dateRange } = options;
    let targetTransactions = onlyOpen ? transactions.filter(t => !t.closed) : transactions;
    
    if (dateRange && dateRange.start && dateRange.end) {
      const start = new Date(dateRange.start);
      const end = new Date(dateRange.end);
      end.setHours(23, 59, 59, 999);
      
      targetTransactions = targetTransactions.filter(t => {
        const tDate = new Date(t.timestamp);
        return tDate >= start && tDate <= end;
      });
    }

    const doc = new jsPDF();
    
    doc.setFontSize(18);
    let title = 'Relatório Geral de Movimentações';
    if (onlyOpen) title = 'Relatório de Fechamento Mensal';
    if (dateRange) title = `Relatório por Período: ${new Date(dateRange.start).toLocaleDateString('pt-BR')} a ${new Date(dateRange.end).toLocaleDateString('pt-BR')}`;
    
    doc.text(title, 14, 22);
    
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 14, 30);

    // Summary Table
    autoTable(doc, {
      startY: 35,
      head: [['Resumo Financeiro', 'Valor']],
      body: [
        ['Saldo Inicial', `R$ ${initialBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`],
        ['Total de Entradas', `R$ ${totalIn.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`],
        ['Total de Saídas', `R$ ${totalOut.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`],
        ['Devoluções ao Caixa', `R$ ${totalReturned.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`],
        ['Reembolsos Pagos', `R$ ${totalRefunded.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`],
        ['Resultado Líquido', `R$ ${(totalIn - totalOut).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`],
        ['Saldo Atual', `R$ ${balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`],
      ],
      theme: 'grid',
      headStyles: { fillColor: [52, 152, 219] },
      styles: { fontSize: 10, cellPadding: 3 }
    });

    const tableData = targetTransactions.map(tx => [
      tx.date,
      tx.responsible,
      tx.description,
      tx.type === 'ENTRADA' ? 'Entrada' : 'Saída',
      `R$ ${Math.abs(tx.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      translateStatus(tx.status)
    ]);

    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text('Detalhamento das Movimentações', 14, (doc as any).lastAutoTable.finalY + 15);

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 20,
      head: [['Data', 'Responsável', 'Descrição', 'Tipo', 'Valor', 'Status']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [26, 26, 26] },
      styles: { fontSize: 9 }
    });

    const fileName = dateRange
      ? `Relatorio_Periodo_${dateRange.start}`
      : (onlyOpen ? `Fechamento_Caixinha_${new Date().getMonth() + 1}` : `Relatorio_Caixinha`);
      
    doc.save(`${fileName}.pdf`);
    toast.success("Relatório PDF gerado com sucesso!");
  };

  const generateReceiptPDF = (tx: any) => {
    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(22);
    doc.setTextColor(0);
    doc.text('RECIBO DE ENTREGA DE VALORES', 105, 30, { align: 'center' });
    
    doc.setDrawColor(200);
    doc.line(20, 35, 190, 35);

    // Content
    doc.setFontSize(12);
    doc.text(`Nº do Documento: ${tx.id.substring(0, 8).toUpperCase()}`, 20, 50);
    doc.text(`Data: ${tx.date}`, 140, 50);

    doc.setFontSize(14);
    doc.text('VALOR:', 20, 65);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(`R$ ${Math.abs(tx.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 40, 65);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    const description = `Recebi do Caixa de Pequenas Despesas (Caixinha Pro) a importância acima discriminada, referente a:`;
    const splitDescriptionText = doc.splitTextToSize(description, 170);
    doc.text(splitDescriptionText, 20, 80);

    doc.setFont('helvetica', 'bold');
    doc.text(tx.description, 20, 95);

    doc.setFont('helvetica', 'normal');
    const declaration = `Declaro que os valores serão utilizados exclusivamente para a finalidade descrita acima, comprometendo-me a realizar a prestação de contas no prazo estabelecido.`;
    const splitDeclaration = doc.splitTextToSize(declaration, 170);
    doc.text(splitDeclaration, 20, 110);

    // Signature Area
    doc.line(40, 160, 170, 160);
    doc.setFontSize(11);
    doc.text(tx.responsible.toUpperCase(), 105, 168, { align: 'center' });
    doc.text('RESPONSÁVEL PELO RECEBIMENTO', 105, 175, { align: 'center' });

    // Footer
    doc.setFontSize(9);
    doc.setTextColor(150);
    doc.text('Gerado por Sistema Caixinha Pro', 105, 280, { align: 'center' });

    doc.save(`Recibo_${tx.responsible.replace(/\s+/g, '_')}_${tx.date.replace(/\//g, '-')}.pdf`);
    toast.success("Recibo gerado com sucesso!");
  };

  const fetchInitialData = React.useCallback(async (silent = false) => {
    if (globalThis.__isFetchingInitialData) return;
    
    // Usamos refs locais para controle de concorrência se necessário, 
    // mas o globalThis já ajuda entre instâncias se houver hot-reload estranho
    try {
      globalThis.__isFetchingInitialData = true;
      if (!silent) setLoading(true);

      // Fetch Configs
      const { data: configs } = await supabase.from('app_configs').select('*');
      if (configs) {
        const balanceConfig = configs.find(c => c.key === 'initial_balance');
        const closingConfig = configs.find(c => c.key === 'last_closing_date');
        
        if (balanceConfig) setInitialBalance(Number(balanceConfig.value));
        if (closingConfig) setLastClosingDate(closingConfig.value);
      }

      // Fetch Transactions
      const { data: txs, error } = await supabase
        .from('transactions')
        .select('*')
        .order('timestamp', { ascending: false });

      if (error) throw error;

      if (txs) {
        const mappedTxs = txs.map(t => ({
          ...t,
          reimbursementAmount: t.reimbursement_amount,
          createdBy: t.created_by
        }));
        setTransactions(mappedTxs);
      }

      // Fetch Users
      if (profileRef.current?.role === 'ADMIN' && profileRef.current?.uid) {
        const response = await fetch(`/api/admin/users?adminUid=${profileRef.current.uid}`, {
          cache: 'no-store'
        });
        if (response.ok) {
          const dbUsers = await response.json();
          setUsers(dbUsers);
        } else {
          const { data: dbUsers } = await supabase.from('user_profiles').select('*');
          if (dbUsers) setUsers(dbUsers);
        }
      } else {
        const { data: dbUsers } = await supabase.from('user_profiles').select('*');
        if (dbUsers) setUsers(dbUsers);
      }

    } catch (error: any) {
      console.error('Error fetching data:', error);
      if (!silent) toast.error(`Erro ao carregar dados: ${error.message || 'Erro desconhecido'}`);
    } finally {
      globalThis.__isFetchingInitialData = false;
      if (!silent) setLoading(false);
    }
  }, []); // Dependências vazias para estabilizar. Usaremos o profile via Ref ou passaremos via argumento se necessário.

  const profileRef = React.useRef(profile);
  useEffect(() => {
    profileRef.current = profile;
    // Se o perfil acabou de carregar pela primeira vez, forçamos um fetch
    if (profile?.uid && transactions.length === 0) {
      fetchInitialData();
    }
  }, [profile, transactions.length, fetchInitialData]);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    const debouncedFetch = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fetchInitialData(true), 200);
    };

    // Real-time subscription - Use silent updates for real-time to avoid freezing UI
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transactions' },
        debouncedFetch
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'app_configs' },
        debouncedFetch
      )
      .subscribe();

    return () => {
      clearTimeout(timeoutId);
      supabase.removeChannel(channel);
    };
  }, [fetchInitialData]);

  const handleCreateTransaction = async () => {
    if (!isFinanceiro) {
      toast.error("Apenas o financeiro pode realizar lançamentos.");
      return;
    }
    if (!newTx.amount || !newTx.responsible || !newTx.description) {
      toast.error("Por favor, preencha todos os campos obrigatórios.");
      return;
    }

    const amount = parseFloat(newTx.amount);

    try {
      if (isEditing && editingId) {
        const { error } = await supabase
          .from('transactions')
          .update({
            responsible: newTx.responsible,
            description: newTx.description,
            amount: newTx.type === 'ENTRADA' ? amount : -amount,
            type: newTx.type,
            status: newTx.type === 'ENTRADA' ? 'COMPLETED' : (newTx.requiresSettlement ? 'AWAITING_SETTLEMENT' : 'COMPLETED'),
            updated_at: new Date().toISOString()
          })
          .eq('id', editingId);

        if (error) throw error;
        toast.success("Movimentação atualizada com sucesso!");
      } else {
        const { error } = await supabase
          .from('transactions')
          .insert([{
            responsible: newTx.responsible,
            description: newTx.description,
            amount: newTx.type === 'ENTRADA' ? amount : -amount,
            type: newTx.type,
            date: new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase(),
            timestamp: new Date().toISOString(),
            status: newTx.type === 'ENTRADA' ? 'COMPLETED' : (newTx.requiresSettlement ? 'AWAITING_SETTLEMENT' : 'COMPLETED'),
            created_by: profile?.uid
          }]);

        if (error) throw error;
        toast.success("Movimentação registrada com sucesso!");
      }
      // fetchInitialData() retirado pois o real-time já cuida disso
    } catch (error: any) {
      toast.error("Erro ao salvar no banco de dados.");
      console.error(error);
    }

    setIsDialogOpen(false);
    setIsEditing(false);
    setEditingId(null);
    setNewTx({ type: 'SAIDA', amount: '', responsible: '', description: '', requiresSettlement: true });
  };

  const handleEditTransaction = (tx: any) => {
    setEditingId(tx.id);
    setIsEditing(true);
    setNewTx({
      type: tx.type,
      amount: Math.abs(tx.amount).toString(),
      responsible: tx.responsible,
      description: tx.description,
      requiresSettlement: tx.status === 'AWAITING_SETTLEMENT'
    });
    setIsDialogOpen(true);
  };

  const handleSettlement = (txId: string) => {
    const tx = transactions.find(t => t.id === txId);
    if (!tx) return;

    setSelectedTx(tx);
    if (tx.status === 'AWAITING_REIMBURSEMENT') {
      setIsReimbursementOpen(true);
      return;
    }
    
    setIsSettlementOpen(true);
  };

  const confirmReimbursement = async () => {
    if (!selectedTx) return;
    const amount = selectedTx.reimbursementAmount || 0;
    
    try {
      // 1. Create reimbursement transaction
      const { error: insertError } = await supabase
        .from('transactions')
        .insert([{
          responsible: selectedTx.responsible,
          description: `Reembolso pago: ${selectedTx.description}`,
          amount: -amount,
          type: 'SAIDA',
          date: new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase(),
          timestamp: new Date().toISOString(),
          status: 'COMPLETED',
          created_by: profile?.uid
        }]);

      if (insertError) throw insertError;

      // 2. Mark original transaction as COMPLETED
      const { error: updateError } = await supabase
        .from('transactions')
        .update({ status: 'COMPLETED' })
        .eq('id', selectedTx.id);

      if (updateError) throw updateError;

      toast.success("Reembolso pago e registrado com sucesso!");
      setIsReimbursementOpen(false);
      setIsPendingListOpen(false);
      fetchInitialData();
    } catch (error: any) {
      toast.error("Erro ao processar reembolso no banco.");
      console.error(error);
    }
  };

  const finalizeSettlement = async () => {
    if (!settlementData.amountSpent) {
      toast.error("Por favor, informe o valor gasto.");
      return;
    }

    const spent = parseFloat(settlementData.amountSpent);
    const initial = Math.abs(selectedTx.amount);
    const diff = initial - spent;

    try {
      if (diff > 0) {
        // Sobrou dinheiro -> Devolução
        const { error: insertError } = await supabase
          .from('transactions')
          .insert([{
            responsible: selectedTx.responsible,
            description: `Devolução de saldo: ${selectedTx.description}`,
            amount: diff,
            type: 'ENTRADA',
            date: new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase(),
            timestamp: new Date().toISOString(),
            status: 'COMPLETED',
            created_by: profile?.uid
          }]);
        if (insertError) throw insertError;
        
        const { error: updateError } = await supabase
          .from('transactions')
          .update({ status: 'COMPLETED' })
          .eq('id', selectedTx.id);
        if (updateError) throw updateError;
        
        toast.success(`Prestação finalizada. R$ ${diff.toFixed(2)} devolvidos ao caixa.`);
      } else if (diff < 0) {
        // Faltou dinheiro -> Reembolso
        const reimbursementAmount = Math.abs(diff);
        const { error: updateError } = await supabase
          .from('transactions')
          .update({ 
            status: 'AWAITING_REIMBURSEMENT', 
            reimbursement_amount: reimbursementAmount 
          })
          .eq('id', selectedTx.id);
        if (updateError) throw updateError;
        
        toast.info(`Prestação registrada. Reembolso de R$ ${reimbursementAmount.toFixed(2)} pendente.`);
      } else {
        const { error: updateError } = await supabase
          .from('transactions')
          .update({ status: 'COMPLETED' })
          .eq('id', selectedTx.id);
        if (updateError) throw updateError;
        toast.success("Prestação finalizada com sucesso!");
      }

      fetchInitialData();
      setIsSettlementOpen(false);
      setIsPendingListOpen(false);
      setSettlementData({ amountSpent: '', attachments: [] });
    } catch (error: any) {
      toast.error("Erro ao finalizar prestação no banco.");
      console.error(error);
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    if (!isAdmin) {
      toast.error("Apenas administradores podem excluir lançamentos.");
      return;
    }
    if (confirm("Tem certeza que deseja excluir este lançamento?")) {
      try {
        const { error } = await supabase.from('transactions').delete().eq('id', id);
        if (error) throw error;
        toast.success("Lançamento excluído.");
        fetchInitialData();
      } catch (error: any) {
        toast.error("Erro ao excluir do banco.");
      }
    }
  };

  const handleResetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/`,
      });
      if (error) {
        if (error.message.includes('rate limit')) {
          toast.error("Limite de e-mails atingido. Tente usar a redefinição manual abaixo.");
          return;
        }
        throw error;
      }
      toast.success("E-mail de redefinição de senha enviado.");
    } catch (error: any) {
      console.error(error);
      toast.error("Erro ao enviar e-mail de redefinição.");
    }
  };

  const handleUpdatePasswordDirectly = async () => {
    if (!newUser.password || newUser.password.length < 6) {
      toast.error("A senha deve ter no mínimo 6 caracteres.");
      return;
    }

    try {
      const response = await fetch('/api/admin/set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetEmail: newUser.email,
          newPassword: newUser.password,
          adminUid: user?.uid
        })
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Erro ao atualizar senha');

      toast.success("Senha atualizada com sucesso!");
      setNewUser({ ...newUser, password: '' });
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Erro ao definir senha.");
    }
  };

  const handleSaveUser = async () => {
    if (!newUser.email || !newUser.name) {
      toast.error("Preencha todos os campos obrigatórios.");
      return;
    }

    try {
      if (editingUser) {
        const response = await fetch('/api/admin/users', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            uid: editingUser.uid,
            name: newUser.name,
            role: newUser.role,
            adminUid: profile?.uid
          })
        });

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || "Erro ao atualizar colaborador");
        }

        toast.success("Dados do colaborador atualizados.");
      } else {
        const response = await fetch('/api/admin/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: newUser.email.toLowerCase(),
            name: newUser.name,
            role: newUser.role,
            adminUid: profile?.uid
          })
        });

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || "Erro ao cadastrar colaborador");
        }

        const data = await response.json();
        if (data.tempPassword) {
           toast.success(`Colaborador cadastrado! Senha inicial: ${data.tempPassword}`, {
             duration: 10000
           });
        } else {
           toast.success("Colaborador cadastrado com sucesso.");
        }
      }

      setIsUserDialogOpen(false);
      setEditingUser(null);
      setNewUser({ email: '', name: '', role: 'FINANCEIRO', password: '' });
      fetchInitialData();
    } catch (error: any) {
      console.error("Erro ao salvar usuário:", error);
      toast.error(error.message || "Erro ao salvar usuário no banco.");
    }
  };

  const handleDeleteUser = async (uid: string) => {
    console.log('Tentativa de exclusão. Target UID:', uid, 'Admin UID:', profile?.uid);
    if (uid === profile?.uid) {
      toast.error("Você não pode excluir seu próprio usuário.");
      return;
    }
    if (confirm("Tem certeza que deseja remover este colaborador? Isso também removerá sua conta de acesso.")) {
      try {
        const url = `/api/admin/users?uid=${uid}&adminUid=${profile?.uid}`;
        console.log('Chamando API de exclusão:', url);
        
        const response = await fetch(url, {
          method: 'DELETE'
        });

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || "Erro ao remover colaborador");
        }

        toast.success("Colaborador removido com sucesso.");
        fetchInitialData();
      } catch (error: any) {
        console.error("Erro ao excluir usuário:", error);
        toast.error(error.message || "Erro ao remover usuário do banco.");
      }
    }
  };

  const handleBulkCleanup = async () => {
    const keepEmails = [
      'ricardomelo@browne.com.br',
      'ricardomelo@charquesuprema.com.br',
      'pedro@browne.com.br',
      'teste4@teste.com.br'
    ];

    if (!confirm(`Deseja realmente limpar a base de dados? Todos os usuários EXCETO ${keepEmails.join(', ')} serão removidos.`)) {
      return;
    }

    setLoading(true);
    let successCount = 0;
    let failCount = 0;

    try {
      for (const u of users) {
        if (!keepEmails.includes(u.email.toLowerCase())) {
          try {
            const url = `/api/admin/users?uid=${u.uid}&adminUid=${profile?.uid}`;
            const response = await fetch(url, { method: 'DELETE' });
            if (response.ok) {
              successCount++;
            } else {
              failCount++;
              console.error(`Falha ao excluir ${u.email}:`, await response.text());
            }
          } catch (e) {
            failCount++;
            console.error(e);
          }
        }
      }
      toast.success(`Limpeza concluída! ${successCount} usuários removidos. ${failCount} falhas.`);
      fetchInitialData();
    } catch (error) {
      toast.error("Erro durante a limpeza em lote.");
    } finally {
      setLoading(false);
    }
  };

  const totalIn = transactions.filter(t => t.type === 'ENTRADA' && !t.closed).reduce((acc, t) => acc + t.amount, 0);
  const totalOut = Math.abs(transactions.filter(t => t.type === 'SAIDA' && t.status !== 'CANCELLED' && !t.closed).reduce((acc, t) => acc + t.amount, 0));
  
  const totalReturned = transactions
    .filter(t => !t.closed && t.type === 'ENTRADA' && t.description.startsWith('Devolução'))
    .reduce((acc, t) => acc + t.amount, 0);
  
  const totalRefunded = Math.abs(transactions
    .filter(t => !t.closed && t.type === 'SAIDA' && t.description.startsWith('Reembolso pago'))
    .reduce((acc, t) => acc + t.amount, 0));

  const balance = Number(initialBalance) + totalIn - totalOut;

  // Monthly totals for the dashboard cards
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  
  const totalInMonth = transactions
    .filter(t => {
      if (t.type !== 'ENTRADA' || t.closed) return false;
      if (!t.timestamp) return false;
      const d = new Date(t.timestamp);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    })
    .reduce((acc, t) => acc + t.amount, 0);

  const totalOutMonth = Math.abs(transactions
    .filter(t => {
      if (t.type !== 'SAIDA' || t.status === 'CANCELLED' || t.closed) return false;
      if (!t.timestamp) return false;
      const d = new Date(t.timestamp);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    })
    .reduce((acc, t) => acc + t.amount, 0));

  const handleManualClosing = () => {
    const openTxs = transactions.filter(t => !t.closed);
    if (openTxs.length === 0) {
      toast.error("Não há movimentações abertas para realizar o fechamento.");
      return;
    }
    setClosingStep('CONFIRM');
    setIsClosingDialogOpen(true);
  };

  const executeClosing = async (carryOverPending: boolean) => {
    const pendingTxs = transactions.filter(t => (t.status === 'AWAITING_SETTLEMENT' || t.status === 'AWAITING_REIMBURSEMENT') && !t.closed);
    
    let newInitialBalance = balance;
    if (carryOverPending) {
      const pendingSum = pendingTxs.reduce((acc, t) => acc + t.amount, 0);
      newInitialBalance = balance - pendingSum;
    }

    try {
      const now = new Date().toISOString();
      
      // 1. Update initial balance in DB
      await supabase.from('app_configs').upsert({ key: 'initial_balance', value: newInitialBalance.toString() });
      
      // 2. Mark transactions as closed
      if (carryOverPending && pendingTxs.length > 0) {
        const pendingIds = pendingTxs.map(t => t.id);
        await supabase
          .from('transactions')
          .update({ closed: true })
          .eq('closed', false)
          .filter('id', 'not.in', `(${pendingIds.join(',')})`);
      } else {
        await supabase
          .from('transactions')
          .update({ closed: true })
          .eq('closed', false);
      }

      // 3. Mark last closing date
      await supabase.from('app_configs').upsert({ key: 'last_closing_date', value: now });

      toast.success(carryOverPending 
        ? "Fechamento realizado! Pendências transportadas para o novo mês." 
        : "Fechamento realizado! Saldo consolidado e histórico preservado.");
      
      setIsClosingDialogOpen(false);
      fetchInitialData();
    } catch (error: any) {
      toast.error("Erro ao realizar fechamento no banco.");
      console.error(error);
    }
  };

  const handleReopenMonth = async () => {
    try {
      await supabase
        .from('transactions')
        .update({ closed: false })
        .eq('closed', true);
      
      await supabase.from('app_configs').delete().eq('key', 'last_closing_date');
      
      toast.success("Mês reaberto com sucesso! Todas as movimentações voltaram para o estado aberto.");
      setIsReopenDialogOpen(false);
      fetchInitialData();
    } catch (error: any) {
      toast.error("Erro ao reabrir mês no banco.");
    }
  };

  const handleResetSystem = async () => {
    if (confirm("VOCÊ TEM CERTEZA? Isso apagará TODO o histórico de movimentações.")) {
      try {
        await supabase.from('transactions').delete().neq('responsible', ''); // Hacky way to delete all
        await supabase.from('app_configs').upsert({ key: 'initial_balance', value: '5100' });
        await supabase.from('app_configs').delete().eq('key', 'last_closing_date');
        
        toast.success("Sistema resetado com sucesso!");
        setIsResetDialogOpen(false);
        fetchInitialData();
      } catch (error: any) {
        toast.error("Erro ao resetar banco.");
      }
    }
  };

  const pendingSettlement = transactions.filter(t => t.status === 'AWAITING_SETTLEMENT').length;
  const pendingReimbursement = transactions.filter(t => t.status === 'AWAITING_REIMBURSEMENT').length;

  const filteredTransactions = transactions.filter(tx => {
    const matchesSearch = 
      tx.responsible.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesType = filterType === 'ALL' || tx.type === filterType;
    const matchesStatus = filterStatus === 'ALL' || tx.status === filterStatus;
    const matchesPeriod = filterPeriod === 'ALL' || !tx.closed;

    // Date filtering
    let matchesDate = true;
    if (startDate || endDate) {
      let txDateStr = '';
      
      if (tx.timestamp) {
        const d = new Date(tx.timestamp);
        // Get local YYYY-MM-DD
        txDateStr = d.getFullYear() + '-' + 
                    String(d.getMonth() + 1).padStart(2, '0') + '-' + 
                    String(d.getDate()).padStart(2, '0');
      } else if (tx.date) {
        // Fallback for old data: parse "DD MMM YYYY" (e.g., "15 ABR 2026")
        const parts = tx.date.split(' ');
        if (parts.length === 3) {
          const day = parts[0].padStart(2, '0');
          const monthStr = parts[1].toUpperCase();
          const year = parts[2];
          const months: { [key: string]: string } = {
            'JAN': '01', 'FEV': '02', 'MAR': '03', 'ABR': '04', 'MAI': '05', 'JUN': '06',
            'JUL': '07', 'AGO': '08', 'SET': '09', 'OUT': '10', 'NOV': '11', 'DEZ': '12'
          };
          const month = months[monthStr];
          if (month) {
            txDateStr = `${year}-${month}-${day}`;
          }
        }
      }

      if (txDateStr) {
        if (startDate && txDateStr < startDate) matchesDate = false;
        if (endDate && txDateStr > endDate) matchesDate = false;
      } else {
        // Se não conseguimos determinar a data e há um filtro ativo, ocultamos para manter a precisão
        matchesDate = false;
      }
    }

    return matchesSearch && matchesType && matchesStatus && matchesPeriod && matchesDate;
  });

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#1A1A1A] font-sans">
      <Toaster position="top-right" />
      {/* Top Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="bg-[#1A1A1A] p-2 rounded-lg">
            <LayoutGrid className="text-white w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Caixinha Pro</h1>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{profile?.name} • {profile?.role}</p>
          </div>
        </div>

        <div className="flex items-center gap-8">
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-widest text-gray-500 font-semibold">Saldo Atual</p>
            <p className="text-2xl font-bold text-[#22C55E]">R$ {balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          </div>
          
          <div className="flex items-center gap-3">
            {isFinanceiro && (
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger render={
                  <Button className="bg-[#1A1A1A] hover:bg-black text-white rounded-lg px-6 py-6 h-auto flex gap-2">
                    <Plus className="w-5 h-5" />
                    <span className="font-semibold">Novo Lançamento</span>
                  </Button>
                } />
                <DialogContent className="sm:max-w-[425px] rounded-2xl">
                  <DialogHeader>
                    <DialogTitle className="text-xl font-bold">Novo Lançamento</DialogTitle>
                    <DialogDescription>
                      Registre uma nova entrada ou saída de dinheiro do caixa.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-6 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="tx-type" className="font-semibold">Tipo de Movimentação</Label>
                      <Select value={newTx.type} onValueChange={(v) => v && setNewTx({...newTx, type: v as any})}>
                        <SelectTrigger id="tx-type" className="rounded-xl h-12">
                          <SelectValue placeholder="Selecione o tipo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ENTRADA">Entrada (+)</SelectItem>
                          <SelectItem value="SAIDA">Saída (-)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="amount" className="font-semibold">Valor (R$)</Label>
                      <Input 
                        id="amount" 
                        type="number" 
                        placeholder="0,00" 
                        className="rounded-xl h-12"
                        value={newTx.amount}
                        onChange={(e) => setNewTx({...newTx, amount: e.target.value})}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="responsible" className="font-semibold">Responsável</Label>
                      <Input 
                        id="responsible" 
                        placeholder="Nome do colaborador" 
                        className="rounded-xl h-12"
                        value={newTx.responsible}
                        onChange={(e) => setNewTx({...newTx, responsible: e.target.value})}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="description" className="font-semibold">Descrição / Motivo</Label>
                      <Input 
                        id="description" 
                        placeholder="Ex: Viagem para entrega" 
                        className="rounded-xl h-12"
                        value={newTx.description}
                        onChange={(e) => setNewTx({...newTx, description: e.target.value})}
                      />
                    </div>
                    {newTx.type === 'SAIDA' && (
                      <div className="flex items-center gap-2">
                        <input 
                          type="checkbox" 
                          id="settlement" 
                          checked={newTx.requiresSettlement}
                          onChange={(e) => setNewTx({...newTx, requiresSettlement: e.target.checked})}
                          className="w-4 h-4 rounded border-gray-300 text-[#1A1A1A] focus:ring-[#1A1A1A]"
                        />
                        <Label htmlFor="settlement" className="text-sm font-medium">Requer prestação de contas</Label>
                      </div>
                    )}
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => {
                      setIsDialogOpen(false);
                      setIsEditing(false);
                      setEditingId(null);
                      setNewTx({ type: 'SAIDA', amount: '', responsible: '', description: '', requiresSettlement: true });
                    }} className="rounded-xl h-12 px-6">Cancelar</Button>
                    <Button onClick={handleCreateTransaction} className="bg-[#1A1A1A] hover:bg-black text-white rounded-xl h-12 px-8 font-semibold">
                      {isEditing ? 'Salvar Alterações' : 'Confirmar Lançamento'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
            <Button variant="ghost" onClick={logout} className="p-3 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50">
              <LogOut className="w-6 h-6" />
            </Button>
          </div>
        </div>
      </header>

      {/* Settlement Dialog */}
      <Dialog open={isSettlementOpen} onOpenChange={setIsSettlementOpen}>
        <DialogContent className="sm:max-w-[500px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Prestação de Contas</DialogTitle>
            <DialogDescription>
              Finalize o processo de retirada de dinheiro.
            </DialogDescription>
          </DialogHeader>
          {selectedTx && (
            <div className="grid gap-6 py-4">
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Valor Retirado</span>
                  <span className="font-bold text-lg">R$ {Math.abs(selectedTx.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Responsável</span>
                  <span className="text-sm font-medium">{selectedTx.responsible}</span>
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="spent" className="font-semibold">Valor Efetivamente Gasto (R$)</Label>
                <Input 
                  id="spent" 
                  type="number" 
                  placeholder="0,00" 
                  className="rounded-xl h-12"
                  value={settlementData.amountSpent}
                  onChange={(e) => setSettlementData({...settlementData, amountSpent: e.target.value})}
                />
              </div>

              <div className="grid gap-2">
                <Label className="font-semibold">Anexar Comprovantes</Label>
                <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 flex flex-col items-center justify-center gap-2 hover:border-gray-300 transition-colors cursor-pointer">
                  <Upload className="w-8 h-8 text-gray-400" />
                  <p className="text-sm text-gray-500 font-medium">Clique ou arraste arquivos aqui</p>
                  <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">PDF, JPG, PNG</p>
                </div>
              </div>

              {settlementData.amountSpent && (
                <div className="p-4 rounded-xl bg-blue-50 border border-blue-100">
                  {parseFloat(settlementData.amountSpent) < Math.abs(selectedTx.amount) ? (
                    <p className="text-sm text-blue-700 font-medium flex items-center gap-2">
                      <ArrowUpCircle className="w-4 h-4" />
                      Saldo a devolver: R$ {(Math.abs(selectedTx.amount) - parseFloat(settlementData.amountSpent)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  ) : parseFloat(settlementData.amountSpent) > Math.abs(selectedTx.amount) ? (
                    <p className="text-sm text-purple-700 font-medium flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      Reembolso pendente: R$ {(parseFloat(settlementData.amountSpent) - Math.abs(selectedTx.amount)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  ) : (
                    <p className="text-sm text-green-700 font-medium flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" />
                      Valores batem perfeitamente.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSettlementOpen(false)} className="rounded-xl h-12 px-6">Cancelar</Button>
            <Button onClick={finalizeSettlement} className="bg-[#1A1A1A] hover:bg-black text-white rounded-xl h-12 px-8 font-semibold">Finalizar Prestação</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reimbursement Confirmation Dialog */}
      <Dialog open={isReimbursementOpen} onOpenChange={setIsReimbursementOpen}>
        <DialogContent className="sm:max-w-[500px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Confirmar Reembolso</DialogTitle>
            <DialogDescription>
              Este reembolso ainda não foi lançado no movimento e só será efetivado após sua confirmação.
            </DialogDescription>
          </DialogHeader>
          {selectedTx && (
            <div className="grid gap-6 py-4">
              <div className="bg-gray-50 p-5 rounded-xl border border-gray-100 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Data Original</p>
                    <p className="text-sm font-semibold">{selectedTx.date}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Responsável</p>
                    <p className="text-sm font-semibold">{selectedTx.responsible}</p>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Descrição</p>
                  <p className="text-sm font-medium">{selectedTx.description}</p>
                </div>
                <div className="pt-4 border-t border-gray-200 grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Valor da Saída</p>
                    <p className="text-sm font-bold text-red-600">R$ {Math.abs(selectedTx.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-purple-400 font-bold uppercase tracking-widest">Valor do Reembolso</p>
                    <p className="text-lg font-black text-purple-700">R$ {(selectedTx.reimbursementAmount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-amber-50 border border-amber-100">
                <p className="text-xs text-amber-700 font-medium flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  Ao confirmar, um novo lançamento de saída será criado automaticamente para registrar o pagamento deste reembolso.
                </p>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsReimbursementOpen(false)} className="rounded-xl h-12 px-6 flex-1 sm:flex-none">Cancelar</Button>
            <Button onClick={confirmReimbursement} className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl h-12 px-8 font-bold flex-1 sm:flex-none">Efetivar Reembolso</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pending List Dialog */}
      <Dialog open={isPendingListOpen} onOpenChange={setIsPendingListOpen}>
        <DialogContent className="sm:max-w-[600px] rounded-2xl p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle className="text-xl font-bold">
              {pendingListType === 'SETTLEMENT' ? 'Pendências de Prestação' : 'Pendências de Reembolso'}
            </DialogTitle>
            <DialogDescription>
              {pendingListType === 'SETTLEMENT' 
                ? 'Lista de saídas que aguardam prestação de contas.' 
                : 'Lista de prestações que aguardam pagamento de reembolso.'}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="divide-y divide-gray-100">
              {transactions
                .filter(tx => 
                  !tx.closed && (
                    pendingListType === 'SETTLEMENT' 
                      ? tx.status === 'AWAITING_SETTLEMENT' 
                      : tx.status === 'AWAITING_REIMBURSEMENT'
                  )
                )
                .map((tx) => (
                  <TransactionItem 
                    key={tx.id} 
                    {...tx} 
                    onSettlement={handleSettlement} 
                    onDelete={handleDeleteTransaction}
                    onEdit={handleEditTransaction}
                    onPrint={generateReceiptPDF}
                    isAdmin={isAdmin}
                  />
                ))}
              {transactions.filter(tx => 
                !tx.closed && (
                  pendingListType === 'SETTLEMENT' 
                    ? tx.status === 'AWAITING_SETTLEMENT' 
                    : tx.status === 'AWAITING_REIMBURSEMENT'
                )
              ).length === 0 && (
                <div className="p-12 text-center">
                  <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="w-6 h-6 text-green-500" />
                  </div>
                  <p className="text-sm text-gray-500 font-medium">Nenhuma pendência encontrada.</p>
                </div>
              )}
            </div>
          </ScrollArea>
          <DialogFooter className="p-6 pt-2">
            <Button variant="outline" onClick={() => setIsPendingListOpen(false)} className="rounded-xl h-12 px-6 w-full sm:w-auto">Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <main className="max-w-7xl mx-auto p-6 space-y-8">
        {/* Navigation Tabs */}
        <Tabs defaultValue="dashboard" className="w-full">
          <div className="flex justify-between items-center mb-6">
            <TabsList className="bg-white border border-gray-200 p-1 rounded-xl h-auto">
              <TabsTrigger value="dashboard" className="rounded-lg px-6 py-2 data-[state=active]:bg-[#F8F9FA] data-[state=active]:shadow-none font-medium">Dashboard</TabsTrigger>
              <TabsTrigger value="movimentacoes" className="rounded-lg px-6 py-2 data-[state=active]:bg-[#F8F9FA] data-[state=active]:shadow-none font-medium">Movimentações</TabsTrigger>
              <TabsTrigger value="relatorios" className="rounded-lg px-6 py-2 data-[state=active]:bg-[#F8F9FA] data-[state=active]:shadow-none font-medium">Relatório / Fechamento</TabsTrigger>
              {isAdmin && (
                <TabsTrigger value="usuarios" className="rounded-lg px-6 py-2 data-[state=active]:bg-[#F8F9FA] data-[state=active]:shadow-none font-medium">Usuários</TabsTrigger>
              )}
            </TabsList>
          </div>

          <TabsContent value="dashboard" className="space-y-8 mt-0">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard 
                title="ENTRADAS (MÊS)" 
                value={`R$ ${totalInMonth.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} 
                icon={<ArrowUpCircle className="text-[#22C55E] w-6 h-6" />} 
                color="text-[#22C55E]"
              />
              <StatCard 
                title="SAÍDAS (MÊS)" 
                value={`R$ ${totalOutMonth.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} 
                icon={<ArrowDownCircle className="text-[#EF4444] w-6 h-6" />} 
                color="text-[#EF4444]"
              />
              <StatCard 
                title="PENDENTES PRESTAÇÃO" 
                value={pendingSettlement.toString()} 
                icon={<Clock className="text-[#EAB308] w-6 h-6" />} 
                color="text-[#EAB308]"
                onClick={() => {
                  setPendingListType('SETTLEMENT');
                  setIsPendingListOpen(true);
                }}
              />
              <StatCard 
                title="PENDENTES REEMBOLSO" 
                value={pendingReimbursement.toString()} 
                icon={<AlertCircle className="text-[#A855F7] w-6 h-6" />} 
                color="text-[#A855F7]"
                onClick={() => {
                  setPendingListType('REIMBURSEMENT');
                  setIsPendingListOpen(true);
                }}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Recent Transactions */}
              <Card className="lg:col-span-2 border-none shadow-sm rounded-2xl overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between bg-white px-6 py-6">
                  <div>
                    <CardTitle className="text-lg font-bold">Últimas Movimentações</CardTitle>
                    <p className="text-sm text-gray-500">Acompanhe os lançamentos mais recentes.</p>
                  </div>
                  <Button variant="ghost" className="text-xs font-semibold text-gray-600">Ver tudo</Button>
                </CardHeader>
                <CardContent className="p-0 bg-white">
                  <ScrollArea className="h-[500px]">
                    <div className="divide-y divide-gray-100">
                      {transactions.filter(tx => !tx.closed).map((tx) => (
                        <TransactionItem 
                          key={tx.id} 
                          {...tx} 
                          onSettlement={handleSettlement} 
                          onDelete={handleDeleteTransaction}
                          onEdit={handleEditTransaction}
                          onPrint={generateReceiptPDF}
                          isAdmin={isAdmin}
                        />
                      ))}
                      {transactions.filter(tx => !tx.closed).length === 0 && (
                        <div className="p-12 text-center text-gray-400">
                          Nenhuma movimentação no período atual.
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Quick Actions */}
              <div className="space-y-6">
                <Card className="border-none shadow-sm rounded-2xl overflow-hidden">
                  <CardHeader className="bg-white px-6 py-6">
                    <CardTitle className="text-lg font-bold">Ações Rápidas</CardTitle>
                    <p className="text-sm text-gray-500">Atalhos para tarefas comuns.</p>
                  </CardHeader>
                  <CardContent className="px-6 pb-8 space-y-3 bg-white">
                    <ActionButton icon={<Plus className="w-5 h-5" />} label="Registrar Entrada/Saída" onClick={() => setIsDialogOpen(true)} />
                    <ActionButton icon={<History className="w-5 h-5" />} label="Histórico Completo" />
                    <ActionButton icon={<FileText className="w-5 h-5" />} label="Exportar Relatório Mensal" onClick={() => generatePDF({ onlyOpen: true })} />
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="movimentacoes" className="space-y-6 mt-0">
            <Card className="border-none shadow-sm rounded-2xl overflow-hidden">
              <CardHeader className="bg-white px-6 py-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-lg font-bold">Histórico de Movimentações</CardTitle>
                  <p className="text-sm text-gray-500">Lista completa de todas as entradas e saídas.</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative flex-1 md:flex-none">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input 
                      placeholder="Buscar por responsável ou motivo..." 
                      className="pl-10 rounded-xl w-full md:w-[300px]" 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  
                  <Popover>
                    <PopoverTrigger render={
                      <Button variant="outline" className="rounded-xl flex gap-2">
                        <Filter className="w-4 h-4" />
                        Filtros
                        {(filterType !== 'ALL' || filterStatus !== 'ALL' || startDate || endDate) && (
                          <Badge className="ml-1 px-1.5 py-0.5 bg-black text-white text-[10px]">
                            {(filterType !== 'ALL' ? 1 : 0) + (filterStatus !== 'ALL' ? 1 : 0) + (startDate ? 1 : 0) + (endDate ? 1 : 0)}
                          </Badge>
                        )}
                      </Button>
                    } />
                    <PopoverContent className="w-80 rounded-2xl p-6" align="end">
                      <div className="space-y-6">
                        <div className="flex items-center justify-between">
                          <h4 className="font-bold text-sm">Filtros Avançados</h4>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-black"
                            onClick={() => {
                              setFilterType('ALL');
                              setFilterStatus('ALL');
                              setFilterPeriod('OPEN');
                              setStartDate('');
                              setEndDate('');
                            }}
                          >
                            Limpar
                          </Button>
                        </div>
                        
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                              <Label htmlFor="date-start" className="text-xs font-bold text-gray-500 uppercase tracking-widest">Início</Label>
                              <Input 
                                id="date-start"
                                type="date" 
                                className="rounded-xl text-xs" 
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="date-end" className="text-xs font-bold text-gray-500 uppercase tracking-widest">Fim</Label>
                              <Input 
                                id="date-end"
                                type="date" 
                                className="rounded-xl text-xs" 
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="type-filter" className="text-xs font-bold text-gray-500 uppercase tracking-widest">Tipo</Label>
                            <Select value={filterType} onValueChange={setFilterType}>
                              <SelectTrigger id="type-filter" className="rounded-xl">
                                <SelectValue placeholder="Todos os tipos" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="ALL">Todos os tipos</SelectItem>
                                <SelectItem value="ENTRADA">Apenas Entradas</SelectItem>
                                <SelectItem value="SAIDA">Apenas Saídas</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="status-filter" className="text-xs font-bold text-gray-500 uppercase tracking-widest">Status</Label>
                            <Select value={filterStatus} onValueChange={setFilterStatus}>
                              <SelectTrigger id="status-filter" className="rounded-xl">
                                <SelectValue placeholder="Todos os status" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="ALL">Todos os status</SelectItem>
                                <SelectItem value="COMPLETED">Finalizado</SelectItem>
                                <SelectItem value="AWAITING_SETTLEMENT">Pendente Prestação</SelectItem>
                                <SelectItem value="AWAITING_REIMBURSEMENT">Pendente Reembolso</SelectItem>
                                <SelectItem value="CANCELLED">Cancelado</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="period-filter" className="text-xs font-bold text-gray-500 uppercase tracking-widest">Período</Label>
                            <Select value={filterPeriod} onValueChange={(v: any) => setFilterPeriod(v)}>
                              <SelectTrigger id="period-filter" className="rounded-xl">
                                <SelectValue placeholder="Período" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="OPEN">Apenas Mês Atual (Aberto)</SelectItem>
                                <SelectItem value="ALL">Histórico Completo (Auditável)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </CardHeader>
              <CardContent className="p-0 bg-white">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-y border-gray-100">
                        <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-gray-500">Data</th>
                        <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-gray-500">Responsável</th>
                        <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-gray-500">Descrição</th>
                        <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-gray-500">Tipo</th>
                        <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-gray-500">Status</th>
                        <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-gray-500 text-right">Valor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredTransactions.map((tx) => (
                        <tr key={tx.id} className="hover:bg-gray-50 transition-colors cursor-pointer group" onClick={() => (tx.status === 'AWAITING_SETTLEMENT' || tx.status === 'AWAITING_REIMBURSEMENT') && handleSettlement(tx.id)}>
                          <td className="px-6 py-4 text-sm font-medium text-gray-600">{tx.date}</td>
                          <td className="px-6 py-4 text-sm font-bold">{tx.responsible}</td>
                          <td className="px-6 py-4 text-sm text-gray-500">{tx.description}</td>
                          <td className="px-6 py-4">
                            <Badge variant="outline" className={tx.type === 'ENTRADA' ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-700 border-red-100'}>
                              {tx.type === 'ENTRADA' ? 'Entrada' : 'Saída'}
                            </Badge>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col gap-1">
                              <StatusBadge status={tx.status} />
                              {tx.closed && (
                                <Badge variant="outline" className="bg-gray-100 text-gray-400 border-gray-200 text-[9px] font-bold w-fit">CONSOLIDADO</Badge>
                              )}
                            </div>
                          </td>
                          <td className={`px-6 py-4 text-sm font-bold text-right ${tx.type === 'ENTRADA' ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                            <div className="flex items-center justify-end gap-3">
                              <span>{tx.type === 'ENTRADA' ? '+' : '-'} R$ {Math.abs(tx.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                              {isFinanceiro && (
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  {tx.type === 'SAIDA' && (
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      className="text-gray-400 hover:text-green-600 h-8 w-8"
                                      title="Imprimir Recibo"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        generateReceiptPDF(tx);
                                      }}
                                    >
                                      <Printer className="w-4 h-4" />
                                    </Button>
                                  )}
                                  {isAdmin && (
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      className="text-gray-400 hover:text-blue-500 h-8 w-8"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleEditTransaction(tx);
                                      }}
                                    >
                                      <RefreshCcw className="w-4 h-4" />
                                    </Button>
                                  )}
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="text-gray-400 hover:text-red-500 h-8 w-8"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteTransaction(tx.id);
                                    }}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {filteredTransactions.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-6 py-20 text-center">
                            <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                              <Search className="w-6 h-6 text-gray-300" />
                            </div>
                            <p className="text-sm text-gray-500 font-medium">Nenhuma movimentação encontrada com os filtros aplicados.</p>
                            <Button 
                              variant="link" 
                              className="mt-2 text-black font-bold"
                              onClick={() => {
                                setSearchQuery('');
                                setFilterType('ALL');
                                setFilterStatus('ALL');
                                setFilterPeriod('OPEN');
                                setStartDate('');
                                setEndDate('');
                              }}
                            >
                              Limpar todos os filtros
                            </Button>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="relatorios" className="space-y-6 mt-0">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                {isAdmin && (
                  <Card className="border-none shadow-sm rounded-2xl overflow-hidden">
                    <CardHeader className="bg-white px-6 py-6">
                      <CardTitle className="text-lg font-bold">Configurações de Caixa</CardTitle>
                      <p className="text-sm text-gray-500">Ajuste o saldo inicial e parâmetros do sistema.</p>
                    </CardHeader>
                    <CardContent className="px-6 pb-8 bg-white space-y-6">
                      <div className="space-y-2">
                        <Label htmlFor="initial-balance-input" className="font-semibold">Saldo Inicial do Mês (R$)</Label>
                        <div className="flex gap-3">
                          <Input 
                            id="initial-balance-input"
                            type="number" 
                            className="rounded-xl h-12" 
                            value={initialBalance}
                            onChange={(e) => setInitialBalance(Number(e.target.value))}
                          />
                          <Button 
                            className="bg-[#1A1A1A] hover:bg-black text-white rounded-xl h-12 px-8 font-semibold" 
                            onClick={async () => {
                              try {
                                await supabase.from('app_configs').upsert({ key: 'initial_balance', value: initialBalance.toString() });
                                toast.success("Saldo inicial atualizado!");
                                fetchInitialData();
                              } catch (e) {
                                toast.error("Erro ao salvar saldo inicial.");
                              }
                            }}
                          >
                            Salvar
                          </Button>
                        </div>
                      </div>
                      <Separator />
                      <p className="text-[10px] text-gray-400 font-medium">Nota: Alterar o saldo inicial afetará todos os cálculos de saldo atual retroativamente.</p>
                    </CardContent>
                  </Card>
                )}

                <Card className="border-none shadow-sm rounded-2xl overflow-hidden">
                  <CardHeader className="bg-white px-6 py-6">
                    <CardTitle className="text-lg font-bold">Fechamento Mensal</CardTitle>
                    <p className="text-sm text-gray-500">Gere o relatório detalhado de todas as movimentações do mês atual.</p>
                  </CardHeader>
                  <CardContent className="px-6 pb-8 bg-white space-y-6">
                    <div className="bg-[#F8F9FA] p-6 rounded-2xl space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-500 font-medium">Último Fechamento:</span>
                        <span className="text-sm font-bold text-gray-700">
                          {lastClosingDate ? new Date(lastClosingDate).toLocaleString('pt-BR') : 'Nenhum registro'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-500 font-medium">Mês de Referência:</span>
                        <span className="text-sm font-bold uppercase tracking-wider">
                          {new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-500 font-medium">Lançamentos em Aberto:</span>
                        <span className="text-sm font-bold text-blue-600">{transactions.filter(t => !t.closed).length}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                      <Button 
                        onClick={() => generatePDF({ onlyOpen: true })}
                        className="w-full bg-[#1A1A1A] hover:bg-black text-white rounded-xl h-14 font-bold flex gap-3 items-center justify-center text-base"
                      >
                        <FileText className="w-5 h-5" />
                        Gerar Relatório PDF
                      </Button>
                      <Button 
                        onClick={() => exportToExcel({ onlyOpen: true })}
                        variant="outline"
                        className="w-full border-green-600 text-green-700 hover:bg-green-50 rounded-xl h-14 font-bold flex gap-3 items-center justify-center text-base"
                      >
                        <History className="w-5 h-5" />
                        Exportar Tabela Excel
                      </Button>

                      {isAdmin && (
                        <>
                          <Button 
                            onClick={handleManualClosing}
                            disabled={!!lastClosingDate}
                            className={`w-full ${!!lastClosingDate ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-red-50 hover:bg-red-100 text-red-600 border border-red-100'} rounded-xl h-14 font-bold flex gap-3 items-center justify-center text-base mt-4`}
                          >
                            <Lock className="w-5 h-5" />
                            {lastClosingDate ? 'Mês já Fechado' : 'Realizar Fechamento Mensal'}
                          </Button>

                          {lastClosingDate && (
                            <Button 
                              onClick={() => setIsReopenDialogOpen(true)}
                              className="w-full bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-100 rounded-xl h-14 font-bold flex gap-3 items-center justify-center text-base mt-2"
                            >
                              <RefreshCcw className="w-5 h-5" />
                              Reabrir Mês (Erro de Fechamento)
                            </Button>
                          )}

                          <Button 
                            onClick={() => setIsResetDialogOpen(true)}
                            variant="ghost"
                            className="w-full text-gray-400 hover:text-red-500 hover:bg-red-50 h-10 mt-2 text-xs font-bold uppercase tracking-widest gap-2"
                          >
                            <Trash2 className="w-4 h-4" />
                            Resetar Banco de Dados do Sistema
                          </Button>

                          <Dialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
                            <DialogContent className="sm:max-w-[425px] rounded-3xl">
                              <DialogHeader>
                                <DialogTitle className="text-xl font-bold text-red-600 flex items-center gap-2">
                                  <AlertCircle className="w-6 h-6" />
                                  Atenção: Resetar Sistema
                                </DialogTitle>
                                <DialogDescription className="text-gray-500 pt-2">
                                  Esta ação irá apagar <strong>todas as movimentações</strong> e resetar o saldo inicial para R$ 5.100,00.
                                  <br /><br />
                                  <span className="text-red-600 font-bold">Esta ação é irreversível.</span> Os usuários cadastrados serão preservados.
                                </DialogDescription>
                              </DialogHeader>
                              <div className="flex flex-col gap-3 mt-6">
                                <Button 
                                  variant="destructive"
                                  className="h-12 rounded-xl font-bold"
                                  onClick={handleResetSystem}
                                >
                                  Sim, desejo resetar tudo
                                </Button>
                                <Button 
                                  variant="ghost"
                                  className="h-12 rounded-xl font-bold"
                                  onClick={() => setIsResetDialogOpen(false)}
                                >
                                  Cancelar
                                </Button>
                              </div>
                            </DialogContent>
                          </Dialog>

                          <Dialog open={isReopenDialogOpen} onOpenChange={setIsReopenDialogOpen}>
                            <DialogContent className="sm:max-w-[425px] rounded-3xl">
                              <DialogHeader>
                                <DialogTitle className="text-xl font-bold text-blue-600 flex items-center gap-2">
                                  <RefreshCcw className="w-6 h-6" />
                                  Reabrir Mês Atual
                                </DialogTitle>
                                <DialogDescription className="text-gray-500 pt-2">
                                  Esta função deve ser usada <strong>apenas em caso de erro no fechamento</strong>.
                                  <br /><br />
                                  Ao reabrir, todas as movimentações consolidadas voltarão a ficar &quot;em aberto&quot;. O sistema deixará de considerar o saldo transportado e voltará a calcular o saldo atual dinamicamente.
                                </DialogDescription>
                              </DialogHeader>
                              <div className="flex flex-col gap-3 mt-6">
                                <Button 
                                  className="h-12 rounded-xl font-bold bg-blue-600 hover:bg-blue-700"
                                  onClick={handleReopenMonth}
                                >
                                  Confirmar Reabertura
                                </Button>
                                <Button 
                                  variant="ghost"
                                  className="h-12 rounded-xl font-bold"
                                  onClick={() => setIsReopenDialogOpen(false)}
                                >
                                  Voltar
                                </Button>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-none shadow-sm rounded-2xl overflow-hidden">
                  <CardHeader className="bg-white px-6 py-6">
                    <CardTitle className="text-lg font-bold">Relatório por Período</CardTitle>
                    <p className="text-sm text-gray-500">Exporte movimentações de um intervalo de datas específico.</p>
                  </CardHeader>
                  <CardContent className="px-6 pb-8 bg-white space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="report-start-date" className="text-xs font-bold uppercase text-gray-400">Data Inicial</Label>
                        <Input 
                          id="report-start-date"
                          type="date" 
                          className="rounded-xl h-12" 
                          value={reportStartDate}
                          onChange={(e) => setReportStartDate(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="report-end-date" className="text-xs font-bold uppercase text-gray-400">Data Final</Label>
                        <Input 
                          id="report-end-date"
                          type="date" 
                          className="rounded-xl h-12" 
                          value={reportEndDate}
                          onChange={(e) => setReportEndDate(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <Button 
                        disabled={!reportStartDate || !reportEndDate}
                        onClick={() => generatePDF({ dateRange: { start: reportStartDate, end: reportEndDate } })}
                        className="flex-1 bg-white border border-gray-200 hover:bg-gray-50 text-gray-900 rounded-xl h-12 font-bold flex gap-2 items-center justify-center"
                      >
                        <FileText className="w-4 h-4" />
                        PDF por Período
                      </Button>
                      <Button 
                        disabled={!reportStartDate || !reportEndDate}
                        onClick={() => exportToExcel({ dateRange: { start: reportStartDate, end: reportEndDate } })}
                        variant="outline"
                        className="flex-1 border-green-600 text-green-700 hover:bg-green-50 rounded-xl h-12 font-bold flex gap-2 items-center justify-center"
                      >
                        <FileSpreadsheet className="w-4 h-4" />
                        Excel por Período
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-none shadow-sm rounded-2xl overflow-hidden">
                  <CardHeader className="bg-white px-6 py-6">
                    <CardTitle className="text-lg font-bold">Resumo Financeiro</CardTitle>
                    <p className="text-sm text-gray-500">Visão geral financeira do mês atual.</p>
                  </CardHeader>
                  <CardContent className="px-6 pb-8 bg-white space-y-8">
                    <div className="grid grid-cols-2 gap-8">
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Saldo Inicial do Período</p>
                        <p className="text-2xl font-bold text-gray-700">R$ {initialBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Saldo Atual (Consolidado)</p>
                        <p className="text-2xl font-bold text-[#22C55E]">R$ {balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                      </div>
                    </div>

                    <Separator />
                    
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <h4 className="text-sm font-bold uppercase tracking-wider text-gray-500">Prévia do Fechamento</h4>
                        <Badge className="bg-blue-50 text-blue-700 border-blue-100">
                          {transactions.filter(t => !t.closed).length} Itens
                        </Badge>
                      </div>
                      
                      <div className="border rounded-xl overflow-hidden">
                        <ScrollArea className="h-[200px]">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead className="bg-gray-50 sticky top-0">
                              <tr>
                                <th className="px-4 py-2 font-bold text-gray-400">ITEM</th>
                                <th className="px-4 py-2 font-bold text-gray-400 text-right">VALOR</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {transactions.filter(t => !t.closed).map(t => (
                                <tr key={t.id} className="hover:bg-gray-50">
                                  <td className="px-4 py-2">
                                    <p className="font-bold">{t.responsible}</p>
                                    <p className="text-[10px] text-gray-400 truncate max-w-[150px]">{t.description}</p>
                                  </td>
                                  <td className={`px-4 py-2 font-bold text-right ${t.type === 'ENTRADA' ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                                    {t.type === 'ENTRADA' ? '+' : '-'} {Math.abs(t.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                  </td>
                                </tr>
                              ))}
                              {transactions.filter(t => !t.closed).length === 0 && (
                                <tr>
                                  <td colSpan={2} className="px-4 py-8 text-center text-gray-400 italic">Sem lançamentos abertos</td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </ScrollArea>
                      </div>
                    </div>

                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                      <p className="text-xs text-blue-700 leading-relaxed">
                        <strong>Como funciona o fechamento:</strong> Ao realizar o fechamento, todas as movimentações atuais (exceto pendências transportadas) são arquivadas no histórico. O <strong>Saldo Atual</strong> torna-se o novo <strong>Saldo Inicial</strong> do próximo período, garantindo a continuidade do caixa.
                      </p>
                    </div>
                    <Separator />
                    <div className="space-y-4">
                      <div className="flex justify-between items-center text-gray-400 font-bold uppercase tracking-widest text-[10px]">
                        <span>Detalhamento do Período</span>
                        <span>Compilado</span>
                      </div>
                      <div className="space-y-4 bg-gray-50/50 p-4 rounded-2xl border border-gray-100">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-gray-600">Entradas Brutas</span>
                          <span className="text-sm font-bold text-[#22C55E]">+ R$ {(totalIn - totalReturned).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-gray-600">Saídas Brutas</span>
                          <span className="text-sm font-bold text-[#EF4444]">- R$ {(totalOut - totalRefunded).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <Separator className="bg-gray-200" />
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-gray-600">Devoluções (Prestação de Contas)</span>
                          <span className="text-sm font-bold text-blue-600 tracking-tight">+ R$ {totalReturned.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-gray-600">Reembolsos (Pago p/ Colaborador)</span>
                          <span className="text-sm font-bold text-purple-600 tracking-tight">- R$ {totalRefunded.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <Separator className="bg-gray-200" />
                        <div className="flex justify-between items-center pt-1">
                          <span className="text-sm font-bold text-gray-900">Resultado Líquido do Mês</span>
                          <div className="text-right">
                            <span className={`text-lg font-black ${(totalIn - totalOut) >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                              {(totalIn - totalOut) >= 0 ? '+' : ''} R$ {(totalIn - totalOut).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card className="border-none shadow-sm rounded-2xl overflow-hidden">
                <CardHeader className="bg-white px-6 py-6">
                  <CardTitle className="text-lg font-bold">Distribuição</CardTitle>
                  <p className="text-sm text-gray-500">Categorias mais utilizadas.</p>
                </CardHeader>
                <CardContent className="px-6 pb-8 bg-white flex flex-col items-center justify-center h-[300px]">
                  <div className="w-40 h-40 rounded-full border-[12px] border-gray-100 border-t-[#EF4444] border-r-[#22C55E] flex items-center justify-center">
                    <div className="text-center">
                      <p className="text-xs font-bold text-gray-400 uppercase">Gasto</p>
                      <p className="text-xl font-bold">31%</p>
                    </div>
                  </div>
                  <div className="mt-8 grid grid-cols-2 gap-4 w-full">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-[#EF4444]" />
                      <span className="text-xs font-medium text-gray-600">Saídas</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-[#22C55E]" />
                      <span className="text-xs font-medium text-gray-600">Entradas</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          <TabsContent value="usuarios" className="space-y-6 mt-0">
            <Card className="border-none shadow-sm rounded-2xl overflow-hidden">
              <CardHeader className="bg-white px-6 py-6 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-bold">Gestão de Colaboradores</CardTitle>
                  <p className="text-sm text-gray-500">Gerencie quem tem acesso ao sistema e seus respectivos níveis de permissão.</p>
                </div>
                <div className="flex gap-2">
                  {profile?.email === 'ricardomelo@browne.com.br' && (
                    <Button 
                      variant="outline"
                      onClick={handleBulkCleanup} 
                      className="border-red-200 text-red-600 hover:bg-red-50 rounded-xl h-12 px-6 font-semibold flex gap-2"
                    >
                      <Trash2 className="w-5 h-5" />
                      Limpar Sujeira
                    </Button>
                  )}
                  <Button onClick={() => {
                    setEditingUser(null);
                    setNewUser({ email: '', name: '', role: 'FINANCEIRO', password: '' });
                    setIsUserDialogOpen(true);
                  }} className="bg-[#1A1A1A] hover:bg-black text-white rounded-xl h-12 px-6 font-semibold flex gap-2">
                    <UserPlus className="w-5 h-5" />
                    Novo Colaborador
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0 bg-white">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-y border-gray-100">
                        <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-gray-500">Nome</th>
                        <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-gray-500">E-mail</th>
                        <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-gray-500">Função</th>
                        <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-gray-500 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {users.map((u) => (
                        <tr key={u.uid} className="hover:bg-gray-50 transition-colors group">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500">
                                {u.name.charAt(0).toUpperCase()}
                              </div>
                              <span className="text-sm font-bold">{u.name}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">{u.email}</td>
                          <td className="px-6 py-4">
                            <Badge variant="outline" className={
                              u.role === 'ADMIN' ? 'bg-red-50 text-red-700 border-red-100' : 
                              u.role === 'FINANCEIRO' ? 'bg-blue-50 text-blue-700 border-blue-100' : 
                              'bg-gray-50 text-gray-700 border-gray-100'
                            }>
                              {u.role}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-blue-500" onClick={() => {
                                setEditingUser(u);
                                setNewUser({ email: u.email, name: u.name, role: u.role, password: '' });
                                setIsUserDialogOpen(true);
                              }}>
                                <RefreshCcw className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-red-500" onClick={() => handleDeleteUser(u.uid)}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* User Management Dialog */}
      <Dialog open={isUserDialogOpen} onOpenChange={setIsUserDialogOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">{editingUser ? 'Editar Colaborador' : 'Novo Colaborador'}</DialogTitle>
            <DialogDescription>
              Defina as permissões e dados de acesso do colaborador.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 py-4">
            <div className="grid gap-2">
              <Label htmlFor="userName" className="font-semibold">Nome Completo</Label>
              <Input 
                id="userName" 
                placeholder="Ex: João Silva" 
                className="rounded-xl h-12"
                value={newUser.name}
                onChange={(e) => setNewUser({...newUser, name: e.target.value})}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="userEmail" className="font-semibold">E-mail de Acesso</Label>
              <Input 
                id="userEmail" 
                type="email"
                placeholder="email@empresa.com" 
                className="rounded-xl h-12"
                value={newUser.email}
                onChange={(e) => setNewUser({...newUser, email: e.target.value})}
              />
              {editingUser ? (
                <div className="space-y-4 p-4 bg-blue-50 rounded-2xl border border-blue-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Key className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-bold text-blue-900">Gerenciar Senha</span>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex-1 h-9 text-xs bg-white border-blue-200 text-blue-700 hover:bg-blue-100 rounded-xl"
                        onClick={() => handleResetPassword(newUser.email)}
                      >
                        Enviar E-mail de Recuperação
                      </Button>
                    </div>

                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t border-blue-200" />
                      </div>
                      <div className="relative flex justify-center text-xs">
                        <span className="bg-blue-50 px-2 text-blue-400">OU DEFINA MANUALMENTE</span>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Input
                        type="text"
                        placeholder="Nova senha manual"
                        className="h-9 text-xs rounded-xl bg-white border-blue-200"
                        value={newUser.password}
                        onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                      />
                      <Button 
                        size="sm" 
                        className="h-9 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-xl"
                        onClick={handleUpdatePasswordDirectly}
                      >
                        Salvar Senha
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-[10px] text-gray-500 bg-gray-50 p-2 rounded-lg border border-gray-100">
                  <strong>Aviso:</strong> Ao cadastrar aqui, o colaborador deverá clicar em &quot;Cadastrar&quot; na tela de login para definir sua própria senha de forma segura.
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="user-role-select" className="font-semibold">Função / Nível de Acesso</Label>
              <Select value={newUser.role} onValueChange={(v) => v && setNewUser({...newUser, role: v})}>
                <SelectTrigger id="user-role-select" className="rounded-xl h-12">
                  <SelectValue placeholder="Selecione a função" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">Administrador (Acesso Total)</SelectItem>
                  <SelectItem value="FINANCEIRO">Financeiro (Lançamentos e Relatórios)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsUserDialogOpen(false)} className="rounded-xl h-12 px-6">Cancelar</Button>
            <Button onClick={handleSaveUser} className="bg-[#1A1A1A] hover:bg-black text-white rounded-xl h-12 px-8 font-semibold">
              {editingUser ? 'Salvar Alterações' : 'Cadastrar Colaborador'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Closing Confirmation Dialog */}
      <Dialog open={isClosingDialogOpen} onOpenChange={setIsClosingDialogOpen}>
        <DialogContent className="sm:max-w-[450px] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">
              {closingStep === 'CONFIRM' ? 'Confirmar Fechamento' : 'Transportar Pendências?'}
            </DialogTitle>
            <DialogDescription>
              {closingStep === 'CONFIRM' ? (
                transactions.some(t => (t.status === 'AWAITING_SETTLEMENT' || t.status === 'AWAITING_REIMBURSEMENT') && !t.closed)
                  ? `Atenção: Existem prestações ou reembolsos PENDENTES. Deseja fechar o mês mesmo assim?`
                  : `Deseja realizar o fechamento do mês? O saldo atual de R$ ${balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} será definido como o novo Saldo Inicial.`
              ) : (
                "Existem pendências em aberto. Você deseja que elas continuem aparecendo no próximo mês ou prefere que sejam arquivadas no histórico deste mês?"
              )}
            </DialogDescription>
          </DialogHeader>
          
          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            {closingStep === 'CONFIRM' ? (
              <>
                <Button variant="outline" onClick={() => setIsClosingDialogOpen(false)} className="rounded-xl h-12 px-6">
                  Cancelar
                </Button>
                <Button 
                  onClick={() => {
                    const hasPending = transactions.some(t => (t.status === 'AWAITING_SETTLEMENT' || t.status === 'AWAITING_REIMBURSEMENT') && !t.closed);
                    if (hasPending) {
                      setClosingStep('PENDING_CHOICE');
                    } else {
                      executeClosing(false);
                    }
                  }} 
                  className="bg-red-600 hover:bg-red-700 text-white rounded-xl h-12 px-8 font-semibold"
                >
                  Continuar
                </Button>
              </>
            ) : (
              <>
                <Button 
                  variant="outline" 
                  onClick={() => executeClosing(false)} 
                  className="rounded-xl h-12 px-6 flex-1"
                >
                  Congelar no Histórico
                </Button>
                <Button 
                  onClick={() => executeClosing(true)} 
                  className="bg-[#1A1A1A] hover:bg-black text-white rounded-xl h-12 px-8 font-semibold flex-1"
                >
                  Transportar para Próximo Mês
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'COMPLETED':
      return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Finalizado</Badge>;
    case 'AWAITING_SETTLEMENT':
      return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Pendente Prestação</Badge>;
    case 'AWAITING_REIMBURSEMENT':
      return <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">Pendente Reembolso</Badge>;
    case 'CANCELLED':
      return <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">Cancelado</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function StatCard({ title, value, icon, color, onClick }: { title: string, value: string, icon: React.ReactNode, color: string, onClick?: () => void }) {
  return (
    <Card 
      className={`border-none shadow-sm rounded-2xl overflow-hidden transition-all ${onClick ? 'cursor-pointer hover:ring-2 hover:ring-gray-100 active:scale-[0.98]' : ''}`}
      onClick={onClick}
    >
      <CardContent className="p-6 space-y-2">
        <p className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">{title}</p>
        <div className="flex items-center gap-3">
          {icon}
          <p className={`text-2xl font-bold ${color}`}>{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function TransactionItem({ id, responsible, description, amount, type, date, status, closed, onSettlement, onDelete, onEdit, onPrint, isAdmin }: any) {
  const isPositive = type === 'ENTRADA';
  const isPending = status === 'AWAITING_SETTLEMENT' || status === 'AWAITING_REIMBURSEMENT';
  
  return (
    <div 
      className={`px-6 py-5 flex items-center justify-between hover:bg-gray-50 transition-colors cursor-pointer group relative ${closed ? 'opacity-75' : ''}`}
      onClick={() => isPending && !closed && onSettlement && onSettlement(id)}
    >
      <div className="flex items-center gap-4">
        <div className={`p-2 rounded-full ${isPositive ? 'bg-green-50' : 'bg-red-50'}`}>
          {isPositive ? (
            <ArrowUpCircle className="w-6 h-6 text-[#22C55E]" />
          ) : (
            <ArrowDownCircle className="w-6 h-6 text-[#EF4444]" />
          )}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <p className="font-bold text-[15px]">{responsible}</p>
            {closed && (
              <Badge variant="outline" className="bg-gray-100 text-gray-600 border-gray-200 text-[10px] font-bold">FECHADO</Badge>
            )}
            {status === 'AWAITING_SETTLEMENT' && !closed && (
              <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 text-[10px] font-bold">PRESTAÇÃO PENDENTE</Badge>
            )}
            {status === 'AWAITING_REIMBURSEMENT' && !closed && (
              <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-[10px] font-bold">REEMBOLSO PENDENTE</Badge>
            )}
          </div>
          <p className="text-xs text-gray-500 line-clamp-1">{description}</p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className={`font-bold text-[15px] ${isPositive ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
            {isPositive ? '+' : '-'} R$ {Math.abs(amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">{date}</p>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {!isPositive && onPrint && (
            <Button 
              variant="ghost" 
              size="icon" 
              className="text-gray-400 hover:text-green-600"
              onClick={(e) => {
                e.stopPropagation();
                onPrint({ id, responsible, description, amount, type, date, status });
              }}
            >
              <Printer className="w-4 h-4" />
            </Button>
          )}
          {isAdmin && !closed && (
            <>
              <Button 
                variant="ghost" 
                size="icon" 
                className="text-gray-400 hover:text-blue-500"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit({ id, responsible, description, amount, type, date, status });
                }}
              >
                <RefreshCcw className="w-4 h-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="text-gray-400 hover:text-red-500"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(id);
                }}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ActionButton({ icon, label, onClick }: { icon: React.ReactNode, label: string, onClick?: () => void }) {
  return (
    <Button variant="outline" onClick={onClick} className="w-full justify-start gap-4 py-6 rounded-xl border-gray-200 hover:bg-gray-50 hover:border-gray-300 transition-all text-gray-700 font-semibold">
      <div className="text-gray-400">{icon}</div>
      {label}
    </Button>
  );
}
