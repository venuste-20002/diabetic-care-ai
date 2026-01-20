import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Modal,
  Alert,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Users, Search, Filter, MessageSquare, Eye, Calendar, Clock, TrendingUp, TriangleAlert as AlertTriangle, CircleCheck as CheckCircle, ChevronRight, X, Stethoscope, Heart, Activity } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

const { width } = Dimensions.get('window');

interface Patient {
  id: string;
  name: string;
  age: number;
  gender: string;
  lastAssessment: string;
  riskCategory: 'low' | 'moderate' | 'high' | 'critical';
  riskScore: number;
  status: 'pending' | 'reviewed';
  submissionId: string;
}

export default function PatientsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [filteredPatients, setFilteredPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'pending' | 'critical'>('all');
  const [showFilterModal, setShowFilterModal] = useState(false);

  useEffect(() => {
    if (user?.role === 'doctor') {
      loadPatients();
    }
  }, [user]);

  useEffect(() => {
    filterPatients();
  }, [patients, searchQuery, selectedFilter]);

  const loadPatients = async () => {
    setLoading(true);
    try {
      const { data: submissions } = await supabase
        .from('health_submissions')
        .select(`
          id,
          status,
          submitted_at,
          patients!inner (
            id,
            age,
            gender,
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
        const patientData: Patient[] = submissions.map(submission => ({
          id: submission.patients.id,
          name: submission.patients.profiles.full_name,
          age: submission.patients.age || 0,
          gender: submission.patients.gender || 'Unknown',
          lastAssessment: submission.submitted_at,
          riskCategory: submission.risk_predictions?.[0]?.risk_category || 'low',
          riskScore: submission.risk_predictions?.[0]?.risk_score || 0,
          status: submission.status,
          submissionId: submission.id,
        }));

        setPatients(patientData);
      }
    } catch (error) {
      console.error('Error loading patients:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterPatients = () => {
    let filtered = patients;

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(patient =>
        patient.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply status/risk filter
    switch (selectedFilter) {
      case 'pending':
        filtered = filtered.filter(p => p.status === 'pending');
        break;
      case 'critical':
        filtered = filtered.filter(p => p.riskCategory === 'critical');
        break;
    }

    setFilteredPatients(filtered);
  };

  const getRiskColor = (category: string) => {
    switch (category) {
      case 'low':
        return '#28A745';
      case 'moderate':
        return '#FFA500';
      case 'high':
        return '#FF6B35';
      case 'critical':
        return '#DC3545';
      default:
        return '#64748B';
    }
  };

  const getRiskIcon = (category: string) => {
    switch (category) {
      case 'low':
        return CheckCircle;
      case 'moderate':
        return Clock;
      case 'high':
      case 'critical':
        return AlertTriangle;
      default:
        return Heart;
    }
  };

  const handlePatientPress = (patient: Patient) => {
    router.push(`/(tabs)/AssessmentDetailsScreen?id=${patient.submissionId}`);
  };

  const handleChatPress = (patientId: string) => {
    router.push(`/chat/${patientId}`);
  };

  if (user?.role !== 'doctor') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.accessDenied}>
          <Stethoscope size={64} color="#DC3545" />
          <Text style={styles.accessDeniedTitle}>Access Restricted</Text>
          <Text style={styles.accessDeniedText}>
            This section is only available to healthcare providers.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0066CC" />
          <Text style={styles.loadingText}>Loading patients...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Users size={24} color="#0066CC" />
          <Text style={styles.title}>Patient Management</Text>
        </View>
        <Text style={styles.subtitle}>
          {filteredPatients.length} patient{filteredPatients.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {/* Search and Filter */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Search size={20} color="#64748B" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search patients..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setShowFilterModal(true)}
        >
          <Filter size={20} color="#0066CC" />
        </TouchableOpacity>
      </View>

      {/* Quick Stats */}
      <View style={styles.quickStats}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{patients.length}</Text>
          <Text style={styles.statLabel}>Total Patients</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: '#FFA500' }]}>
            {patients.filter(p => p.status === 'pending').length}
          </Text>
          <Text style={styles.statLabel}>Pending Review</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: '#DC3545' }]}>
            {patients.filter(p => p.riskCategory === 'critical').length}
          </Text>
          <Text style={styles.statLabel}>Critical Risk</Text>
        </View>
      </View>

      {/* Patient List */}
      <ScrollView style={styles.patientList} showsVerticalScrollIndicator={false}>
        {filteredPatients.map((patient) => {
          const RiskIcon = getRiskIcon(patient.riskCategory);
          
          return (
            <TouchableOpacity
              key={patient.id}
              style={styles.patientCard}
              onPress={() => handlePatientPress(patient)}
              activeOpacity={0.7}
            >
              <View style={styles.patientHeader}>
                <View style={styles.patientInfo}>
                  <Text style={styles.patientName}>{patient.name}</Text>
                  <Text style={styles.patientDetails}>
                    {patient.age} years • {patient.gender}
                  </Text>
                  <Text style={styles.lastAssessment}>
                    Last assessment: {new Date(patient.lastAssessment).toLocaleDateString()}
                  </Text>
                </View>
                
                <View style={styles.patientMeta}>
                  <View
                    style={[
                      styles.riskBadge,
                      { backgroundColor: `${getRiskColor(patient.riskCategory)}20` },
                    ]}
                  >
                    <RiskIcon size={16} color={getRiskColor(patient.riskCategory)} />
                    <Text
                      style={[
                        styles.riskText,
                        { color: getRiskColor(patient.riskCategory) },
                      ]}
                    >
                      {patient.riskCategory.toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.riskScore}>Score: {patient.riskScore}</Text>
                </View>
              </View>

              <View style={styles.patientFooter}>
                <View
                  style={[
                    styles.statusBadge,
                    patient.status === 'reviewed'
                      ? styles.statusReviewed
                      : styles.statusPending,
                  ]}
                >
                  {patient.status === 'reviewed' ? (
                    <CheckCircle size={12} color="#065F46" />
                  ) : (
                    <Clock size={12} color="#92400E" />
                  )}
                  <Text
                    style={[
                      styles.statusText,
                      patient.status === 'reviewed'
                        ? styles.statusTextReviewed
                        : styles.statusTextPending,
                    ]}
                  >
                    {patient.status}
                  </Text>
                </View>

                <View style={styles.patientActions}>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleChatPress(patient.id)}
                  >
                    <MessageSquare size={16} color="#0066CC" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionButton}>
                    <Eye size={16} color="#64748B" />
                  </TouchableOpacity>
                  <ChevronRight size={16} color="#64748B" />
                </View>
              </View>
            </TouchableOpacity>
          );
        })}

        {filteredPatients.length === 0 && (
          <View style={styles.emptyState}>
            <Users size={48} color="#64748B" />
            <Text style={styles.emptyTitle}>No patients found</Text>
            <Text style={styles.emptyText}>
              {searchQuery || selectedFilter !== 'all'
                ? 'Try adjusting your search or filter criteria'
                : 'Patients will appear here once they complete health assessments'}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Filter Modal */}
      <Modal
        visible={showFilterModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowFilterModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Filter Patients</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowFilterModal(false)}
            >
              <X size={24} color="#64748B" />
            </TouchableOpacity>
          </View>

          <View style={styles.modalContent}>
            {[
              { key: 'all', label: 'All Patients', icon: Users },
              { key: 'pending', label: 'Pending Review', icon: Clock },
              { key: 'critical', label: 'Critical Risk', icon: AlertTriangle },
            ].map((filter) => {
              const IconComponent = filter.icon;
              return (
                <TouchableOpacity
                  key={filter.key}
                  style={[
                    styles.filterOption,
                    selectedFilter === filter.key && styles.filterOptionActive,
                  ]}
                  onPress={() => {
                    setSelectedFilter(filter.key as any);
                    setShowFilterModal(false);
                  }}
                >
                  <IconComponent size={20} color="#0066CC" />
                  <Text style={styles.filterOptionText}>{filter.label}</Text>
                  {selectedFilter === filter.key && (
                    <CheckCircle size={20} color="#0066CC" />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFB',
  },
  accessDenied: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 24,
  },
  accessDeniedTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1E293B',
    textAlign: 'center',
  },
  accessDeniedText: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 24,
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
    backgroundColor: 'white',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
  },
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 12,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1E293B',
  },
  filterButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#EBF4FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickStats: {
    flexDirection: 'row',
    backgroundColor: 'white',
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  statItem: {
    flex: 1,
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
  patientList: {
    flex: 1,
    padding: 24,
  },
  patientCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  patientHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  patientInfo: {
    flex: 1,
  },
  patientName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  patientDetails: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 4,
  },
  lastAssessment: {
    fontSize: 12,
    color: '#64748B',
  },
  patientMeta: {
    alignItems: 'flex-end',
  },
  riskBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 4,
    gap: 4,
  },
  riskText: {
    fontSize: 10,
    fontWeight: '600',
  },
  riskScore: {
    fontSize: 12,
    color: '#64748B',
  },
  patientFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  statusReviewed: {
    backgroundColor: '#D1FAE5',
  },
  statusPending: {
    backgroundColor: '#FEF3C7',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  statusTextReviewed: {
    color: '#065F46',
  },
  statusTextPending: {
    color: '#92400E',
  },
  patientActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F8FAFB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1E293B',
  },
  emptyText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 32,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#F8FAFB',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
  },
  closeButton: {
    padding: 8,
  },
  modalContent: {
    padding: 20,
    gap: 12,
  },
  filterOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  filterOptionActive: {
    backgroundColor: '#EBF4FF',
    borderWidth: 2,
    borderColor: '#0066CC',
  },
  filterOptionText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#1E293B',
  },
});