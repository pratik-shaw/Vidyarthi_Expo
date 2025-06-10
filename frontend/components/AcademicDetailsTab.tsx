import React from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

interface TeacherSubjectMark {
  subjectId: string;
  subjectName: string;
  teacherId: string;
  teacherName?: string;
  fullMarks: number;
  marksScored: number | null;
  percentage: number | null;
  grade: string | null;
  isCompleted: boolean;
  scoredBy: string | null;
  scoredAt: string | null;
}

interface TeacherExamResult {
  examId: string;
  examName: string;
  examCode: string;
  examDate: string;
  subjects: TeacherSubjectMark[];
  totalMarksScored: number;
  totalFullMarks: number;
  percentage: string;
  grade: string | null;
  isCompleted: boolean;
  completedSubjects: number;
  totalSubjects: number;
}

interface TeacherAcademicData {
  hasData: boolean;
  message?: string;
  exams: TeacherExamResult[];
  summary: {
    overallPercentage: string;
    overallGrade: string;
    totalExams: number;
    completedExams: number;
    totalSubjects: number;
    completedSubjects: number;
    completionRate: string;
    totalMarksScored: number;
    totalFullMarks: number;
    examCompletionRate: string;
  } | null;
  lastUpdated?: string;
}

interface AcademicDetailsTabProps {
  academicData: TeacherAcademicData | null;
}

const AcademicDetailsTab: React.FC<AcademicDetailsTabProps> = ({ academicData }) => {
  if (!academicData) {
    return (
      <View style={styles.sectionContainer}>
        <View style={styles.emptyStateContainer}>
          <FontAwesome5 name="graduation-cap" size={36} color="#B0B7C3" />
          <Text style={styles.emptyStateText}>Loading academic data...</Text>
        </View>
      </View>
    );
  }

  if (!academicData.hasData) {
    return (
      <View style={styles.sectionContainer}>
        <View style={styles.emptyStateContainer}>
          <FontAwesome5 name="graduation-cap" size={36} color="#B0B7C3" />
          <Text style={styles.emptyStateText}>No Academic Records</Text>
          <Text style={styles.emptyStateSubtext}>
            {academicData.message || 'No academic records found for subjects you teach'}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.sectionContainer}>
      {/* Overall Performance Card */}
      {academicData.summary && (
        <View style={styles.performanceCard}>
          <LinearGradient
            colors={['#1CB5E0', '#38EF7D']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.performanceGradient}
          >
            <View style={styles.performanceContent}>
              <Text style={styles.performanceTitle}>Overall Performance</Text>
              <Text style={styles.performanceSubtitle}>Subjects You Teach</Text>
              <Text style={styles.performancePercentage}>
                {String(academicData.summary.overallPercentage)}%
              </Text>
              <Text style={styles.performanceGrade}>
                Grade: {String(academicData.summary.overallGrade)}
              </Text>
              <View style={styles.performanceStats}>
                <View style={styles.performanceStatItem}>
                  <Text style={styles.performanceStatValue}>
                    {String(academicData.summary.completedExams)}
                  </Text>
                  <Text style={styles.performanceStatLabel}>Completed Exams</Text>
                </View>
                <View style={styles.performanceStatItem}>
                  <Text style={styles.performanceStatValue}>
                    {String(academicData.summary.completedSubjects)}
                  </Text>
                  <Text style={styles.performanceStatLabel}>Completed Subjects</Text>
                </View>
                <View style={styles.performanceStatItem}>
                  <Text style={styles.performanceStatValue}>
                    {String(academicData.summary.completionRate)}%
                  </Text>
                  <Text style={styles.performanceStatLabel}>Completion Rate</Text>
                </View>
              </View>
            </View>
          </LinearGradient>
        </View>
      )}
      
      {/* Exam Results */}
      {academicData.exams && academicData.exams.length > 0 && academicData.exams.map((exam, index) => (
        <View key={`exam-${exam.examId || index}`} style={styles.examCard}>
          <View style={styles.examHeader}>
            <View style={styles.examTitleContainer}>
              <Text style={styles.examName}>{String(exam.examName || 'Untitled Exam')}</Text>
              <Text style={styles.examCode}>({String(exam.examCode || 'No Code')})</Text>
            </View>
            <View style={styles.examDateContainer}>
              <Text style={styles.examDate}>
                {exam.examDate ? new Date(exam.examDate).toLocaleDateString() : 'No Date'}
              </Text>
              <View style={[
                styles.completionBadge, 
                { backgroundColor: exam.isCompleted ? 'rgba(56, 239, 125, 0.1)' : 'rgba(255, 167, 38, 0.1)' }
              ]}>
                <Text style={[
                  styles.completionText, 
                  { color: exam.isCompleted ? '#38EF7D' : '#FFA726' }
                ]}>
                  {exam.isCompleted ? 'Completed' : 'In Progress'}
                </Text>
              </View>
            </View>
          </View>
          
          <View style={styles.examSummary}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>
                {String(exam.totalMarksScored || 0)}
              </Text>
              <Text style={styles.summaryLabel}>Marks Scored</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>
                {String(exam.totalFullMarks || 0)}
              </Text>
              <Text style={styles.summaryLabel}>Total Marks</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>
                {String(exam.percentage || '0')}%
              </Text>
              <Text style={styles.summaryLabel}>Percentage</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>
                {String(exam.grade || 'N/A')}
              </Text>
              <Text style={styles.summaryLabel}>Grade</Text>
            </View>
          </View>
          
          <View style={styles.subjectsContainer}>
            <Text style={styles.subjectsTitle}>Your Subjects Performance</Text>
            <Text style={styles.subjectsSubtitle}>
              {String(exam.completedSubjects || 0)} of {String(exam.totalSubjects || 0)} subjects completed
            </Text>
            
            {exam.subjects && exam.subjects.length > 0 && exam.subjects.map((subject, idx) => (
              <View key={`subject-${subject.subjectId || idx}`} style={styles.subjectRow}>
                <View style={styles.subjectHeader}>
                  <Text style={styles.subjectName}>
                    {String(subject.subjectName || 'Unknown Subject')}
                  </Text>
                  <View style={[
                    styles.subjectStatus,
                    { 
                      backgroundColor: subject.isCompleted 
                        ? 'rgba(56, 239, 125, 0.1)' 
                        : 'rgba(180, 183, 195, 0.1)' 
                    }
                  ]}>
                    <Text style={[
                      styles.subjectStatusText,
                      { 
                        color: subject.isCompleted ? '#38EF7D' : '#8A94A6'
                      }
                    ]}>
                      {subject.isCompleted ? 'Graded' : 'Pending'}
                    </Text>
                  </View>
                </View>
                
                <View style={styles.subjectDetails}>
                  <Text style={styles.subjectMarks}>
                    {subject.marksScored !== null ? String(subject.marksScored) : '-'}/{String(subject.fullMarks || 0)}
                  </Text>
                  <Text style={styles.subjectPercentage}>
                    {subject.percentage !== null ? `${String(subject.percentage)}%` : 'N/A'}
                  </Text>
                </View>
                
                {subject.scoredBy && (
                  <Text style={styles.scoredByText}>
                    Graded by: {String(subject.scoredBy)}
                  </Text>
                )}
              </View>
            ))}
          </View>
          
          {/* Progress Bar */}
          <View style={styles.progressContainer}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>Completion Progress</Text>
              <Text style={styles.progressPercentage}>
                {exam.totalSubjects > 0 
                  ? String(Math.round((exam.completedSubjects / exam.totalSubjects) * 100))
                  : '0'}%
              </Text>
            </View>
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill,
                  {
                    width: `${exam.totalSubjects > 0 
                      ? Math.round((exam.completedSubjects / exam.totalSubjects) * 100) 
                      : 0}%`
                  }
                ]}
              />
            </View>
          </View>
        </View>
      ))}
      
      {/* Last Updated Info */}
      {academicData.lastUpdated && (
        <View style={styles.lastUpdatedContainer}>
          <FontAwesome5 name="clock" size={14} color="#8A94A6" />
          <Text style={styles.lastUpdatedText}>
            Last updated: {new Date(academicData.lastUpdated).toLocaleString()}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  sectionContainer: {
    padding: 16,
  },
  emptyStateContainer: {
    alignItems: 'center',
    padding: 40,
  },
  emptyStateText: {
    fontSize: 18,
    color: '#8A94A6',
    marginTop: 16,
    textAlign: 'center',
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#B0B7C3',
    marginTop: 8,
    textAlign: 'center',
  },
  performanceCard: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  performanceGradient: {
    padding: 20,
  },
  performanceContent: {
    alignItems: 'center',
  },
  performanceTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  performanceSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 16,
  },
  performancePercentage: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  performanceGrade: {
    fontSize: 16,
    color: '#FFFFFF',
    marginBottom: 20,
  },
  performanceStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  performanceStatItem: {
    alignItems: 'center',
  },
  performanceStatValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  performanceStatLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    marginTop: 4,
  },
  examCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  examHeader: {
    marginBottom: 16,
  },
  examTitleContainer: {
    marginBottom: 8,
  },
  examName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#3A4276',
  },
  examCode: {
    fontSize: 14,
    color: '#8A94A6',
    marginTop: 2,
  },
  examDateContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  examDate: {
    fontSize: 14,
    color: '#8A94A6',
  },
  completionBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  completionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  examSummary: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
    paddingVertical: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#3A4276',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#8A94A6',
    marginTop: 4,
  },
  subjectsContainer: {
    marginBottom: 16,
  },
  subjectsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3A4276',
    marginBottom: 4,
  },
  subjectsSubtitle: {
    fontSize: 14,
    color: '#8A94A6',
    marginBottom: 12,
  },
  subjectRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F2F5',
  },
  subjectHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  subjectName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3A4276',
    flex: 1,
  },
  subjectStatus: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  subjectStatusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  subjectDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  subjectMarks: {
    fontSize: 14,
    color: '#3A4276',
    fontWeight: '500',
  },
  subjectPercentage: {
    fontSize: 14,
    color: '#1CB5E0',
    fontWeight: '600',
  },
  scoredByText: {
    fontSize: 12,
    color: '#8A94A6',
    marginTop: 4,
    fontStyle: 'italic',
  },
  progressContainer: {
    marginTop: 8,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 14,
    color: '#8A94A6',
  },
  progressPercentage: {
    fontSize: 14,
    color: '#1CB5E0',
    fontWeight: '600',
  },
  progressBar: {
    height: 6,
    backgroundColor: '#F0F2F5',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#1CB5E0',
    borderRadius: 3,
  },
  lastUpdatedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginTop: 8,
  },
  lastUpdatedText: {
    fontSize: 12,
    color: '#8A94A6',
    marginLeft: 8,
  },
});

export default AcademicDetailsTab;