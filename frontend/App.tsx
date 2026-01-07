import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// Common/Auth Screens
import IntroScreen from './screens/IntroScreen';
import RoleSelectionScreen from './screens/RoleSelectionScreen';
import AuthController from './screens/AuthController';

// Student Screens
import StudentLoginScreen from './screens/StudentLoginScreen';
import StudentScreen from './screens/StudentScreen';
import StudentHomeScreen from './screens/StudentHomeScreen';
import StudentProfileScreen from './screens/StudentProfileScreen';
import StudentSettingsScreen from './screens/StudentSettingsScreen';
import StudentNotificationsScreen from './screens/StudentNotificationsScreen';
import StudentAttendanceScreen from './screens/StudentAttendanceScreen';
import StudentAcademicsScreen from './screens/StudentAcademicsScreen';
import StudentCalendarScreen from './screens/StudentCalendarScreen';
import StudentConductScreen from './screens/StudentConductScreen';
import StudentChatroomScreen from './screens/StudentChatroomScreen';
import StudentQueryScreen from './screens/StudentQueryScreen';
import StudentSubmissionScreen from './screens/StudentSubmissionScreen';
import StudentStudyMaterialScreen from './screens/StudentStudyMaterialScreen';

// Teacher Screens
import TeacherLoginScreen from './screens/TeacherLoginScreen';
import TeacherScreen from './screens/TeacherScreen';
import TeacherHomeScreen from './screens/TeacherHomeScreen';
import TeacherProfileScreen from './screens/TeacherProfileScreen';
import TeacherClassDetailsScreen from './screens/TeacherClassDetailsScreen';
import TeacherAdminClassDetailsScreen from './screens/TeacherAdminClassDetails ';
import TeacherAdminSubjectsScreen from './screens/TeacherAdminSubjectsScreen';
import TeacherAdminExamsScreen from './screens/TeacherAdminExamsScreen';
import TeacherScoringScreen from './screens/TeacherScoringScreen';
import TeacherStudentDetailsScreen from './screens/TeacherStudentDetailsScreen';
import TeacherAdminStudentReportScreen from './screens/TeacherAdminStudentReport';
import TeacherEventCalendarScreen from './screens/TeacherEventCalendarScreen';
import TeacherSubjectReportScreen from './screens/TeacherSubjectReportScreen';
import TeacherPostMaterialScreen from './screens/TeacherPostMaterialScreen';
import TeacherAdminStudentAcademicSheetScreen from './screens/TeacherAdminStudentAcademicSheetScreen';
import TeacherAdminStudentReportCardScreen from './screens/TeacherAdminStudentReportCardScreen';
import TeacherAdminTakeAttendanceScreen from './screens/TeacherAdminTakeAttendanceScreen';
import TeacherAttendanceSheetScreen from './screens/TeacherAttendanceSheetScreen';

// Admin Screens
import AdminLoginScreen from './screens/AdminLoginScreen';
import AdminScreen from './screens/AdminScreen';
import AdminHomeScreen from './screens/AdminHomeScreen';
import AdminClassesScreen from './screens/AdminClassesScreen';
import AdminAddClassTeacherScreen from './screens/AdminAddClassTeacherScreen';
import AdminAllTeachersDataScreen from './screens/AdminAllTeachersDataScreen';
import AdminAllStudentsDataScreen from './screens/AdminAllStudentsDataScreen';
import AdminStudentQueriesScreen from './screens/AdminStudentQueriesScreen';
import AdminAllClassesDataScreen from './screens/AdminAllClassesData';
import AdminCreateAccountsScreen from './screens/AdminCreateAccountsScreen';

export type RootStackParamList = {
  // Common/Auth Screens
  Intro: undefined;
  RoleSelection: undefined;
  AuthController: undefined;
  
  // Student Screens
  StudentLogin: undefined;
  Student: undefined;
  StudentHome: undefined;
  StudentProfile: undefined;
  StudentSettings: undefined;
  StudentNotifications: undefined;
  StudentAttendance: undefined;
  StudentAcademics: undefined;
  StudentCalendar: undefined;
  StudentConduct: undefined;
  StudentChatroom: undefined;
  StudentQuery: undefined;
  StudentSubmission: undefined;
  StudentStudyMaterial: undefined;
  
  // Teacher Screens
  TeacherLogin: undefined;
  Teacher: undefined;
  TeacherHome: undefined;
  TeacherProfile: undefined;
  TeacherClassDetails: { classId: string; className: string };
  TeacherAdminClassDetails: { classId: string; className: string };
  TeacherAdminSubjects: { classId: string; className: string };
  TeacherAdminExams: { classId: string; className: string };
  TeacherScoring: { classId: string; className: string };
  TeacherStudentDetailsScreen: {
    studentId: string;
    studentName: string;
    classId: string;
    className: string;
  };
  TeacherAdminStudentReport: {
    studentId: string;
    studentName: string;
    classId: string;
    className: string;
  };
  TeacherSubjectReport: {
    subjectId: string;
    subjectName: string;
    classId: string;
    className: string;
  };
  TeacherPostMaterial: {
    classId: string;
    className: string;
    subjectId: string;
    subjectName: string;
  };
  TeacherEventCalendar: { classId: string; className: string };
  TeacherAdminStudentAcademicSheet: {
    studentId: string;
    studentName: string;
    classId: string;
    className: string;
  };
  TeacherAdminStudentReportCard: {
    studentId: string;
    studentName: string;
    classId: string;
    className: string;
  };
  TeacherAdminTakeAttendance: { classId: string; className: string };
  TeacherAttendanceSheet: { classId: string; className: string };
  
  // Admin Screens
  AdminLogin: undefined;
  Admin: undefined;
  AdminHome: undefined;
  AdminClasses: undefined;
  AdminAddClassTeacher: undefined;
  AdminAllTeachersData: undefined;
  AdminAllStudentsData: undefined;
  AdminStudentQueriesScreen: undefined;
  AdminAllClassesData: undefined;
  AdminCreateAccountsScreen: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="AuthController">
        {/* Common/Auth Screens */}
        <Stack.Screen name="Intro" component={IntroScreen} />
        <Stack.Screen name="RoleSelection" component={RoleSelectionScreen} />
        <Stack.Screen name="AuthController" component={AuthController} />
        
        {/* Student Screens */}
        <Stack.Screen name="StudentLogin" component={StudentLoginScreen} />
        <Stack.Screen name="Student" component={StudentScreen} />
        <Stack.Screen name="StudentHome" component={StudentHomeScreen} />
        <Stack.Screen name="StudentProfile" component={StudentProfileScreen} />
        <Stack.Screen name="StudentSettings" component={StudentSettingsScreen} />
        <Stack.Screen name="StudentNotifications" component={StudentNotificationsScreen} />
        <Stack.Screen name="StudentAttendance" component={StudentAttendanceScreen} />
        <Stack.Screen name="StudentAcademics" component={StudentAcademicsScreen} />
        <Stack.Screen name="StudentCalendar" component={StudentCalendarScreen} />
        <Stack.Screen name="StudentConduct" component={StudentConductScreen} />
        <Stack.Screen name="StudentChatroom" component={StudentChatroomScreen} />
        <Stack.Screen name="StudentQuery" component={StudentQueryScreen} />
        <Stack.Screen name="StudentSubmission" component={StudentSubmissionScreen} />
        <Stack.Screen name="StudentStudyMaterial" component={StudentStudyMaterialScreen} />
        
        {/* Teacher Screens */}
        <Stack.Screen name="TeacherLogin" component={TeacherLoginScreen} />
        <Stack.Screen name="Teacher" component={TeacherScreen} />
        <Stack.Screen name="TeacherHome" component={TeacherHomeScreen} />
        <Stack.Screen name="TeacherProfile" component={TeacherProfileScreen} options={{ headerShown: false }} />
        <Stack.Screen name="TeacherClassDetails" component={TeacherClassDetailsScreen} />
        <Stack.Screen name="TeacherAdminClassDetails" component={TeacherAdminClassDetailsScreen} />
        <Stack.Screen name="TeacherAdminSubjects" component={TeacherAdminSubjectsScreen} />
        <Stack.Screen name="TeacherAdminExams" component={TeacherAdminExamsScreen} />
        <Stack.Screen name="TeacherScoring" component={TeacherScoringScreen} />
        <Stack.Screen name="TeacherStudentDetailsScreen" component={TeacherStudentDetailsScreen} />
        <Stack.Screen name="TeacherAdminStudentReport" component={TeacherAdminStudentReportScreen} />
        <Stack.Screen name="TeacherEventCalendar" component={TeacherEventCalendarScreen} />
        <Stack.Screen name="TeacherSubjectReport" component={TeacherSubjectReportScreen} />
        <Stack.Screen name="TeacherPostMaterial" component={TeacherPostMaterialScreen} />
        <Stack.Screen name="TeacherAdminStudentAcademicSheet" component={TeacherAdminStudentAcademicSheetScreen} />
        <Stack.Screen name="TeacherAdminStudentReportCard" component={TeacherAdminStudentReportCardScreen} />
        <Stack.Screen name="TeacherAdminTakeAttendance" component={TeacherAdminTakeAttendanceScreen} />
        <Stack.Screen name="TeacherAttendanceSheet" component={TeacherAttendanceSheetScreen} />
        
        {/* Admin Screens */}
        <Stack.Screen name="AdminLogin" component={AdminLoginScreen} />
        <Stack.Screen name="Admin" component={AdminScreen} />
        <Stack.Screen name="AdminHome" component={AdminHomeScreen} />
        <Stack.Screen name="AdminClasses" component={AdminClassesScreen} />
        <Stack.Screen name="AdminAddClassTeacher" component={AdminAddClassTeacherScreen} />
        <Stack.Screen name="AdminAllTeachersData" component={AdminAllTeachersDataScreen} />
        <Stack.Screen name="AdminAllStudentsData" component={AdminAllStudentsDataScreen} />
        <Stack.Screen name="AdminStudentQueriesScreen" component={AdminStudentQueriesScreen} />
        <Stack.Screen name="AdminAllClassesData" component={AdminAllClassesDataScreen} />
        <Stack.Screen name="AdminCreateAccountsScreen" component={AdminCreateAccountsScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}