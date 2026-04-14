import { useState, useEffect } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../../firebase'
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts'
import { TrendingUp, Award, DollarSign, ShoppingBag } from 'lucide-react'

export const Metrics = () => {
  const [data, setData] = useState([])
  const [topProducts, setTopProducts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'orders'))
        const orders = snapshot.docs.map(doc => ({
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate() || new Date()
        }))

        // Process revenue by day for the last 7 days
        const last7Days = [...Array(7)].map((_, i) => {
          const d = new Date()
          d.setDate(d.getDate() - i)
          return d.toISOString().split('T')[0]
        }).reverse()

        const revenueByDay = last7Days.map(day => {
          const dayOrders = orders.filter(o => o.createdAt.toISOString().split('T')[0] === day)
          const revenue = dayOrders.reduce((sum, o) => sum + Number(o.total || 0), 0)
          return {
            name: new Date(day).toLocaleDateString('es-MX', { weekday: 'short' }),
            revenue
          }
        })

        setData(revenueByDay)

        // Process top products
        const productCounts = {}
        orders.forEach(order => {
          order.items?.forEach(item => {
            productCounts[item.name] = (productCounts[item.name] || 0) + (item.quantity || 1)
          })
        })

        const sortedProducts = Object.entries(productCounts)
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5)

        setTopProducts(sortedProducts)
        setLoading(false)
      } catch (error) {
        console.error('Error fetching metrics:', error)
        setLoading(false)
      }
    }

    fetchMetrics()
  }, [])

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Chart */}
        <div className="lg:col-span-2 bg-main-900/30 border border-white/5 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-lg font-semibold text-light-100">Ingresos (Últimos 7 días)</h3>
              <p className="text-xs text-light-200/40">Ventas diarias en MXN</p>
            </div>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <TrendingUp size={20} />
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#a34d3b" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#a34d3b" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#fef8e1', opacity: 0.4, fontSize: 12 }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#fef8e1', opacity: 0.4, fontSize: 12 }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#26100b', 
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '12px',
                    color: '#fef8e1'
                  }}
                  itemStyle={{ color: '#a34d3b' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="#a34d3b" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorRev)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Products */}
        <div className="bg-main-900/30 border border-white/5 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-lg font-semibold text-light-100">Top 5 Productos</h3>
            <Award size={20} className="text-amber-400" />
          </div>

          <div className="space-y-4">
            {loading ? (
              <p className="text-center text-light-200/20 py-10">Cargando...</p>
            ) : topProducts.map((product, index) => (
              <div key={product.name} className="flex items-center justify-between p-3 rounded-2xl bg-white/5 group hover:bg-white/10 transition-colors">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-main-400 w-4">{index + 1}</span>
                  <span className="text-sm font-medium text-light-100 truncate max-w-[120px]">{product.name}</span>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-main-800 text-[10px] font-bold text-light-200">
                  <ShoppingBag size={10} />
                  {product.count}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-main-900/30 border border-white/5 rounded-3xl p-6 shadow-sm flex items-center gap-6">
          <div className="h-14 w-14 rounded-2xl bg-main-500/10 flex items-center justify-center text-main-400">
            <DollarSign size={28} />
          </div>
          <div>
            <p className="text-xs font-medium text-light-200/40 uppercase tracking-wider">Ticket Promedio</p>
            <h4 className="text-2xl font-bold text-light-100 mt-1">$145.50</h4>
            <p className="text-[10px] text-emerald-400 flex items-center gap-1 mt-1">
              <TrendingUp size={10} /> +5.2% vs mes pasado
            </p>
          </div>
        </div>
        
        <div className="bg-main-900/30 border border-white/5 rounded-3xl p-6 shadow-sm flex items-center gap-6">
          <div className="h-14 w-14 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-400">
            <ShoppingBag size={28} />
          </div>
          <div>
            <p className="text-xs font-medium text-light-200/40 uppercase tracking-wider">Pedidos Totales</p>
            <h4 className="text-2xl font-bold text-light-100 mt-1">1,284</h4>
            <p className="text-[10px] text-emerald-400 flex items-center gap-1 mt-1">
              <TrendingUp size={10} /> +12.8% vs mes pasado
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
