import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import RoleSelectionScreen from './screens/RoleSelectionScreen';
import StudentScreen from './screens/StudentScreen';
import TeacherScreen from './screens/TeacherScreen';
import AdminScreen from './screens/AdminScreen';
import IntroScreen from './screens/IntroScreen';
import StudentSignupScreen from './screens/StudentSignupScreen';
import TeacherSignupScreen from './screens/TeacherSignupScreen';
import AdminSignupScreen from './screens/AdminSignupScreen';

// Import the login screens directly with full path
import StudentLoginScreen from './screens/StudentLoginScreen';
import TeacherLoginScreen from './screens/TeacherLoginScreen';
import AdminLoginScreen from './screens/AdminLoginScreen';

// Import student screens
import StudentHomeScreen from './screens/StudentHomeScreen';
// You'll need to create or import these screens
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

export type RootStackParamList = {
  Intro: undefined;
  RoleSelection: undefined;
  StudentLogin: undefined;
  TeacherLogin: undefined;
  AdminLogin: undefined;
  Student: undefined;
  Teacher: undefined;
  Admin: undefined;
  StudentSignup: undefined;
  TeacherSignup: undefined; 
  AdminSignup: undefined;
  // Add the missing student screens here
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
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Intro">
        <Stack.Screen name="Intro" component={IntroScreen} />
        <Stack.Screen name="RoleSelection" component={RoleSelectionScreen} />
        <Stack.Screen name="StudentLogin" component={StudentLoginScreen} />
        <Stack.Screen name="TeacherLogin" component={TeacherLoginScreen} />
        <Stack.Screen name="AdminLogin" component={AdminLoginScreen} />
        <Stack.Screen name="Student" component={StudentScreen} />
        <Stack.Screen name="Teacher" component={TeacherScreen} />
        <Stack.Screen name="Admin" component={AdminScreen} />
        <Stack.Screen name="StudentSignup" component={StudentSignupScreen} />
        <Stack.Screen name="TeacherSignup" component={TeacherSignupScreen} />
        <Stack.Screen name="AdminSignup" component={AdminSignupScreen} />
        
        {/* Add the student screens to the navigator */}
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
      </Stack.Navigator>
    </NavigationContainer>
  );
}