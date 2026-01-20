import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ChartBar as BarChart3, TrendingUp, Users, TriangleAlert as AlertTriangle, Clock, Calendar, Activity, Heart, Target, Zap, CircleCheck as CheckCircle, ArrowUpRight, ArrowDownRight, MapPin, Stethoscope, Database, Eye, MessageSquare, FileText, Award } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { generatePublicHealthMetrics, type PublicHealthMetrics } from '@/lib/research';

const { width } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';

interface DashboardStats {
  totalPatients: number;
  pendingReviews: number;
  criticalCases: number;
  monthlyAssessments: number;
  averageRiskScore: number;
  weeklyGrowth: number;
  completionRate: number;
}

interface TrendData {
  label: string;
  value: number;
  change: number;
  trend: 'up' | 'down' | 'stable';
}

export default function DoctorDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats>({
    totalPatients: 0,
    pendingReviews: 0,
    criticalCases: 0,
    monthlyAssessments: 0,
    averageRiskScore: 0,
    weeklyGrowth: 0,
    completionRate: 0,
  });
  const [metrics, setMetrics] = useState<PublicHealthMetrics | null>(null);
  const [trendData, setTrendData] = useState<TrendData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadPatientStats(),
        loadPublicHealthMetrics(),
      ]);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPatientStats = async () => {
    try {
      const { data: submissions } = await supabase
        .from('health_submissions')
        .select(`
          id,
          status,
          submitted_at,
          patients!inner (
            id,
            profiles!inner (
              full_name
            )
          ),
          risk_predictions (
            risk_score,
            risk_category
          )
        `)
        .order('submitted_at', { ascending: false });

      if (submissions) {
        const uniquePatients = new Set(submissions.map(s => s.patients.id));
        const pendingReviews = submissions.filter(s => s.status === 'pending').length;
        const criticalCases = submissions.filter(
          s => s.risk_predictions?.[0]?.risk_category === 'critical'
        ).length;
        
        const thisMonth = new Date();
        thisMonth.setDate(1);
        const monthlyAssessments = submissions.filter(
          s => new Date(s.submitted_at) >= thisMonth
        ).length;

        const lastMonth = new Date();
        lastMonth.setMonth(lastMonth.getMonth() - 1);
        lastMonth.setDate(1);
        const lastMonthEnd = new Date(thisMonth);
        lastMonthEnd.setDate(0);
        
        const lastMonthAssessments = submissions.filter(
          s => new Date(s.submitted_at) >= lastMonth && new Date(s.submitted_at) <= lastMonthEnd
        ).length;

        const weeklyGrowth = lastMonthAssessments > 0 
          ? ((monthlyAssessments - lastMonthAssessments) / lastMonthAssessments) * 100
          : 0;

        const totalRiskScore = submissions.reduce(
          (sum, s) => sum + (s.risk_predictions?.[0]?.risk_score || 0),
          0
        );
        const averageRiskScore = submissions.length > 0 
          ? Math.round(totalRiskScore / submissions.length) 
          : 0;

        const reviewedCount = submissions.filter(s => s.status === 'reviewed').length;
        const completionRate = submissions.length > 0 
          ? Math.round((reviewedCount / submissions.length) * 100)
          : 0;

        setStats({
          totalPatients: uniquePatients.size,
          pendingReviews,
          criticalCases,
          monthlyAssessments,
          averageRiskScore,
          weeklyGrowth,
          completionRate,
        });

        // Generate trend data
        setTrendData([
          {
            label: 'New Patients',
            value: monthlyAssessments,
            change: weeklyGrowth,
            trend: weeklyGrowth > 0 ? 'up' : weeklyGrowth < 0 ? 'down' : 'stable'
          },
          {
            label: 'Avg Risk Score',
            value: averageRiskScore,
            change: -5.2, // Mock data
            trend: 'down'
          },
          {
            label: 'Review Rate',
            value: completionRate,
            change: 12.3, // Mock data
            trend: 'up'
          }
        ]);
      }
    } catch (error) {
      console.error('Error loading patient stats:', error);
    }
  };

  const loadPublicHealthMetrics = async () => {
    try {
      const data = await generatePublicHealthMetrics();
      setMetrics(data);
    } catch (error) {
      console.error('Error loading public health metrics:', error);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0066CC" />
        <Text style={styles.loadingText}>Loading analytics...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.headerIcon}>
            <BarChart3 size={24} color="#0066CC" />
          </View>
          <View>
            <Text style={styles.headerTitle}>Analytics Dashboard</Text>
            <Text style={styles.headerSubtitle}>Real-time health insights</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.refreshButton} onPress={loadDashboardData}>
          <Activity size={20} color="#0066CC" />
        </TouchableOpacity>
      </View>

      {/* Bento Grid Layout */}
      <View style={styles.bentoGrid}>
        {/* Large Stats Card */}
        <View style={[styles.bentoCard, styles.largeCard]}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Patient Overview</Text>
            <Users size={20} color="#0066CC" />
          </View>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{stats.totalPatients}</Text>
              <Text style={styles.statLabel}>Total Patients</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: '#FFA500' }]}>{stats.pendingReviews}</Text>
              <Text style={styles.statLabel}>Pending</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: '#DC3545' }]}>{stats.criticalCases}</Text>
              <Text style={styles.statLabel}>Critical</Text>
            </View>
          </View>
        </View>

        {/* Monthly Assessments */}
        <View style={[styles.bentoCard, styles.mediumCard]}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>This Month</Text>
            <Calendar size={20} color="#28A745" />
          </View>
          <Text style={styles.bigNumber}>{stats.monthlyAssessments}</Text>
          <View style={styles.trendIndicator}>
            {stats.weeklyGrowth > 0 ? (
              <ArrowUpRight size={16} color="#28A745" />
            ) : (
              <ArrowDownRight size={16} color="#DC3545" />
            )}
            <Text style={[
              styles.trendText,
              { color: stats.weeklyGrowth > 0 ? '#28A745' : '#DC3545' }
            ]}>
              {Math.abs(stats.weeklyGrowth).toFixed(1)}%
            </Text>
          </View>
        </View>

        {/* Average Risk Score */}
        <View style={[styles.bentoCard, styles.mediumCard]}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Avg Risk</Text>
            <Target size={20} color="#9B59B6" />
          </View>
          <Text style={styles.bigNumber}>{stats.averageRiskScore}</Text>
          <Text style={styles.cardSubtext}>out of 100</Text>
        </View>

        {/* Trend Analysis */}
        <View style={[styles.bentoCard, styles.wideCard]}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Key Trends</Text>
            <TrendingUp size={20} color="#0066CC" />
          </View>
          <View style={styles.trendsContainer}>
            {trendData.map((trend, index) => (
              <View key={index} style={styles.trendItem}>
                <Text style={styles.trendLabel}>{trend.label}</Text>
                <View style={styles.trendValue}>
                  <Text style={styles.trendNumber}>{trend.value}</Text>
                  <View style={[
                    styles.trendBadge,
                    { backgroundColor: trend.trend === 'up' ? '#D1FAE5' : '#FEE2E2' }
                  ]}>
                    {trend.trend === 'up' ? (
                      <ArrowUpRight size={12} color="#065F46" />
                    ) : (
                      <ArrowDownRight size={12} color="#991B1B" />
                    )}
                    <Text style={[
                      styles.trendChangeText,
                      { color: trend.trend === 'up' ? '#065F46' : '#991B1B' }
                    ]}>
                      {Math.abs(trend.change).toFixed(1)}%
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Quick Actions */}
        <View style={[styles.bentoCard, styles.mediumCard]}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Quick Actions</Text>
            <Zap size={20} color="#FF6B35" />
          </View>
          <View style={styles.actionsList}>
            <TouchableOpacity 
              style={styles.actionItem}
              onPress={() => router.push('/(tabs)/patients')}
            >
              <Eye size={16} color="#0066CC" />
              <Text style={styles.actionText}>Review Pending</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.actionItem}
              onPress={() => router.push('/(tabs)/research')}
            >
              <Database size={16} color="#28A745" />
              <Text style={styles.actionText}>Export Data</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Completion Rate */}
        <View style={[styles.bentoCard, styles.mediumCard]}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Review Rate</Text>
            <CheckCircle size={20} color="#28A745" />
          </View>
          <Text style={styles.bigNumber}>{stats.completionRate}%</Text>
          <View style={styles.progressBar}>
            <View 
              style={[
                styles.progressFill,
                { width: `${stats.completionRate}%` }
              ]} 
            />
          </View>
        </View>

        {/* Geographic Distribution */}
        {metrics && (
          <View style={[styles.bentoCard, styles.wideCard]}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Geographic Distribution</Text>
              <MapPin size={20} color="#4ECDC4" />
            </View>
            <View style={styles.geoStats}>
              <View style={styles.geoItem}>
                <View style={styles.geoIndicator} />
                <Text style={styles.geoLabel}>Urban Areas</Text>
                <Text style={styles.geoValue}>
                  {metrics.demographic_breakdown.urban_vs_rural.urban}
                </Text>
              </View>
              <View style={styles.geoItem}>
                <View style={[styles.geoIndicator, { backgroundColor: '#28A745' }]} />
                <Text style={styles.geoLabel}>Rural Areas</Text>
                <Text style={styles.geoValue}>
                  {metrics.demographic_breakdown.urban_vs_rural.rural}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Risk Distribution */}
        {metrics && (
          <View style={[styles.bentoCard, styles.largeCard]}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Risk Distribution</Text>
              <Heart size={20} color="#DC3545" />
            </View>
            <View style={styles.riskGrid}>
              <View style={styles.riskItem}>
                <View style={[styles.riskIndicator, { backgroundColor: '#28A745' }]} />
                <Text style={styles.riskLabel}>Low Risk</Text>
                <Text style={styles.riskValue}>{metrics.risk_distribution.low}</Text>
              </View>
              <View style={styles.riskItem}>
                <View style={[styles.riskIndicator, { backgroundColor: '#FFA500' }]} />
                <Text style={styles.riskLabel}>Moderate</Text>
                <Text style={styles.riskValue}>{metrics.risk_distribution.moderate}</Text>
              </View>
              <View style={styles.riskItem}>
                <View style={[styles.riskIndicator, { backgroundColor: '#DC3545' }]} />
                <Text style={styles.riskLabel}>Critical</Text>
                <Text style={styles.riskValue}>{metrics.risk_distribution.critical}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Achievement Card */}
        <View style={[styles.bentoCard, styles.mediumCard, styles.achievementCard]}>
          <Award size={32} color="#FFD700" />
          <Text style={styles.achievementTitle}>Great Work!</Text>
          <Text style={styles.achievementText}>
            You've reviewed {stats.completionRate}% of assessments this month
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: '#64748B',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'white',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EBF4FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 2,
  },
  refreshButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EBF4FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bentoGrid: {
    padding: 24,
    gap: 16,
  },
  bentoCard: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  largeCard: {
    minHeight: 160,
  },
  mediumCard: {
    minHeight: 120,
  },
  wideCard: {
    minHeight: 140,
  },
  achievementCard: {
    backgroundColor: '#FFF9E6',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
  },
  cardSubtext: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
  },
  bigNumber: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 8,
  },
  trendIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trendText: {
    fontSize: 14,
    fontWeight: '600',
  },
  trendsContainer: {
    gap: 12,
  },
  trendItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  trendLabel: {
    fontSize: 14,
    color: '#64748B',
  },
  trendValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  trendNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    gap: 2,
  },
  trendChangeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  actionsList: {
    gap: 12,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  progressBar: {
    height: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#28A745',
    borderRadius: 3,
  },
  geoStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  geoItem: {
    alignItems: 'center',
    gap: 8,
  },
  geoIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#0066CC',
  },
  geoLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  geoValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
  },
  riskGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  riskItem: {
    alignItems: 'center',
    gap: 8,
  },
  riskIndicator: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  riskLabel: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
  },
  riskValue: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1E293B',
  },
  achievementTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
    marginTop: 12,
    marginBottom: 8,
  },
  achievementText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
  },
});