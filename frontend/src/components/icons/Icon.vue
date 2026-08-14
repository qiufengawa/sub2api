<template>
  <component
    :is="iconComponent"
    class="ui-lucide-icon"
    :size="pixelSize"
    :stroke-width="strokeWidth"
    aria-hidden="true"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  ArrowDown, ArrowLeft, ArrowRight, ArrowRightLeft, ArrowUp, ArrowUpDown,
  BadgeCheck, Ban, BarChart3, Bell, BookOpen, Box, Brain,
  Calculator, CalendarDays, ChartNoAxesColumn, Check, ChevronDown, ChevronLeft,
  ChevronRight, ChevronUp, CircleAlert, CircleCheck, CircleDollarSign,
  CircleHelp, CircleUser, CircleX, Clipboard, Clock3, Cloud, Copy, Cpu,
  CreditCard, Database, Download, ExternalLink, Eye, EyeOff, FileText,
  Filter, Flame, FlaskConical, Gift, Globe2, House, Inbox, Info, KeyRound,
  LayoutGrid, Lightbulb, Link2, Lock, LogIn, Mail, Menu, MessageCircle, Moon,
  MessageSquare, Minus, MoreHorizontal, Pencil, Play, Plus, RefreshCcw,
  RefreshCw, Search, Server, Settings, ShieldCheck, Sparkles, Sun,
  Terminal, Trash2, TrendingUp, TriangleAlert, Trophy, Upload, User,
  UserPlus, Users, X, Zap
} from 'lucide-vue-next'

const iconMap = {
  play: Play,
  refresh: RefreshCw,
  edit: Pencil,
  trash: Trash2,
  plus: Plus,
  minus: Minus,
  search: Search,
  more: MoreHorizontal,
  chart: BarChart3,
  clock: Clock3,
  link: Link2,
  sync: RefreshCcw,
  chevronDown: ChevronDown,
  chevronRight: ChevronRight,
  chevronLeft: ChevronLeft,
  check: Check,
  x: X,
  eye: Eye,
  eyeOff: EyeOff,
  cog: Settings,
  grid: LayoutGrid,
  chat: MessageCircle,
  lightbulb: Lightbulb,
  arrowRight: ArrowRight,
  arrowLeft: ArrowLeft,
  arrowUp: ArrowUp,
  arrowDown: ArrowDown,
  arrowsUpDown: ArrowUpDown,
  chevronUp: ChevronUp,
  externalLink: ExternalLink,
  checkCircle: CircleCheck,
  xCircle: CircleX,
  exclamationCircle: CircleAlert,
  exclamationTriangle: TriangleAlert,
  trophy: Trophy,
  infoCircle: Info,
  questionCircle: CircleHelp,
  user: User,
  userCircle: CircleUser,
  userPlus: UserPlus,
  users: Users,
  document: FileText,
  clipboard: Clipboard,
  copy: Copy,
  inbox: Inbox,
  download: Download,
  upload: Upload,
  filter: Filter,
  globe: Globe2,
  sort: ArrowUpDown,
  key: KeyRound,
  lock: Lock,
  shield: ShieldCheck,
  menu: Menu,
  calendar: CalendarDays,
  home: House,
  terminal: Terminal,
  gift: Gift,
  creditCard: CreditCard,
  mail: Mail,
  chartBar: ChartNoAxesColumn,
  trendingUp: TrendingUp,
  database: Database,
  cube: Box,
  bell: Bell,
  bolt: Zap,
  sparkles: Sparkles,
  cloud: Cloud,
  server: Server,
  sun: Sun,
  moon: Moon,
  book: BookOpen,
  dollar: CircleDollarSign,
  ban: Ban,
  login: LogIn,
  swap: ArrowRightLeft,
  beaker: FlaskConical,
  cpu: Cpu,
  chatBubble: MessageSquare,
  calculator: Calculator,
  fire: Flame,
  badge: BadgeCheck,
  brain: Brain
} as const

const props = withDefaults(defineProps<{
  name: keyof typeof iconMap
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  strokeWidth?: number
}>(), { size: 'md', strokeWidth: 1.75 })

const iconComponent = computed(() => iconMap[props.name])
const pixelSize = computed(() => ({ xs: 12, sm: 16, md: 20, lg: 24, xl: 32 })[props.size])
</script>

<style scoped>
.ui-lucide-icon { display: block; flex: none; }
</style>
