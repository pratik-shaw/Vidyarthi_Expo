// StudentAttendanceScreen.tsx
import React from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';

const StudentAttendanceScreen: React.FC = () => {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>Attendance</Text>
        <Text style={styles.description}>Student attendance screen will be implemented here.</Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8F9FC',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#F8F9FC',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#3A4276',
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    color: '#8A94A6',
    textAlign: 'center',
  },
});

export default StudentAttendanceScreen;